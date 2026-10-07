const crypto = require('node:crypto');
const Lead = require('../models/Lead');
const Client = require('../models/CoworkingClient');
const Board = require('../models/CoworkingBoardState');
const Booking = require('../models/CoworkingBooking');
const Contract = require('../models/CoworkingContract');
const { createHttpError } = require('../utils/httpError');
const externalId = (companyId, type, id) => `toor:${String(companyId).toLowerCase()}:${type}:${String(id).toLowerCase()}`;
const modelFor = (type) => type === 'lead' ? Lead : type === 'coworking-client' ? Client : null;
const validBookedCabin = (cabin) => cabin?.status === 'BOOKED'
  && Boolean(String(cabin.client?.name || '').trim())
  && Boolean(String(cabin.contract?.id || '').trim())
  && Number.isFinite(Date.parse(cabin.contract?.startDate))
  && Number.isFinite(Date.parse(cabin.contract?.endDate))
  && Date.parse(cabin.contract.endDate) >= Date.parse(cabin.contract.startDate);
async function loadEligible(companyId, type, id) {
  const Model = modelFor(type);
  if (!Model || !/^[a-f\d]{24}$/i.test(String(id))) throw createHttpError(400, 'Invalid customer');
  const entity = await Model.findOne({ _id: id, companyId }).lean();
  if (!entity) throw createHttpError(404, 'Customer not found');
  id = entity._id;
  if (type === 'lead') {
    if (entity.status !== 'CLOSED') throw createHttpError(409, 'Only closed customers are eligible');
  } else {
    const board = await Board.findOne({ companyId }).lean();
    const booked = board?.state?.cabins?.some(c => validBookedCabin(c) && !c.client.billingIdentityError && (String(c.client.canonicalClientId) === String(id) || String(c.client.id) === String(id)));
    const operational = booked || await Booking.exists({ companyId, clientId: id, status: { $in: ['ACTIVE', 'COMPLETED'] } })
      || await Contract.exists({ companyId, clientId: id, status: { $in: ['ACTIVE', 'EXPIRING', 'EXPIRED', 'TERMINATED'] } });
    if (!operational) throw createHttpError(409, 'Customer has no eligible booking or contract');
  }
  return entity;
}
function customerPayload(companyId, type, entity) {
  const address = entity.address || {};
  const payload = {
    externalId: externalId(companyId, type, entity._id), source: 'THE_OFFICE_ON_RENT_CRM',
    name: String(type === 'lead' ? entity.name || '' : entity.companyName || '').trim(),
    phone: String(entity.phone || '').trim(), email: String(entity.email || '').trim(),
    billingAddress: type === 'lead' ? '' : ['line1', 'line2', 'city', 'state', 'pincode', 'country'].map(k => address[k]).filter(Boolean).join(', '),
    gstNumber: String(entity.gstNumber || '').trim(),
  };
  if (!payload.name || (!payload.phone && !payload.email)) throw createHttpError(409, 'Customer needs a name and phone or email before billing');
  return payload;
}
const fingerprint = (payload) => crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
async function buildBillingContext(companyId, type, entity) {
  if (!entity) return null;
  if (type === 'lead') {
    let inventory = null;
    if (entity.inventoryId) {
      const Inventory = require('../models/Inventory');
      inventory = await Inventory.findOne({ _id: entity.inventoryId, companyId }).lean();
    }

    const reqType = String(entity.requirements?.inventoryType || '').toUpperCase();
    const invType = String(inventory?.inventoryType || '').toUpperCase();
    const isResidential = reqType === 'RESIDENTIAL' || (!reqType && invType === 'RESIDENTIAL');

    const billingType = isResidential ? 'RESIDENTIAL' : 'COMMERCIAL';
    const billingEntityCode = isResidential ? 'GOLDHAWK' : '';

    const brokerage = typeof entity.brokerageReceived === 'number' && entity.brokerageReceived > 0
      ? entity.brokerageReceived
      : 0;

    let propDesc = '';
    if (inventory) {
      propDesc = [inventory.projectName, inventory.towerName, inventory.unitNumber ? `Unit ${inventory.unitNumber}` : '']
        .filter(Boolean).join(', ');
    } else if (entity.projectInterested) {
      propDesc = entity.projectInterested;
    }

    return {
      billingType,
      billingEntityCode,
      sourceRef: {
        source: 'THE_OFFICE_ON_RENT_CRM',
        sourceType: 'lead',
        sourceId: String(entity._id),
        billingPurpose: 'BROKERAGE',
        billingPeriod: '',
      },
      prefill: {
        notes: propDesc ? `Property: ${propDesc}` : '',
        reference: entity.dealPayment?.paymentReference || (inventory?.propertyId ? `PropID: ${inventory.propertyId}` : ''),
        lineItems: [
          {
            productName: `Brokerage Services - ${isResidential ? 'Residential' : 'Commercial'}`,
            quantity: 1,
            rate: brokerage,
            rateReliable: brokerage > 0,
            hsnSac: '997222',
          },
        ],
      },
    };
  }

  if (['coworking-client', 'board'].includes(type)) {
    const contract = await Contract.findOne({
      companyId,
      clientId: entity._id,
      status: { $in: ['ACTIVE', 'EXPIRING', 'EXPIRED'] },
    }).sort({ createdAt: -1 }).lean();

    const booking = !contract ? await Booking.findOne({
      companyId,
      clientId: entity._id,
      status: { $in: ['ACTIVE', 'COMPLETED', 'CONFIRMED'] },
    }).sort({ createdAt: -1 }).lean() : null;

    const now = new Date();
    const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    if (contract) {
      const rent = typeof contract.rent === 'number' && contract.rent > 0 ? contract.rent : 0;
      return {
        billingType: 'COWORKING',
        billingEntityCode: '',
        sourceRef: {
          source: 'THE_OFFICE_ON_RENT_CRM',
          sourceType: 'coworking-contract',
          sourceId: String(contract._id),
          billingPurpose: 'RENT',
          billingPeriod: currentPeriod,
        },
        prefill: {
          notes: `Contract: ${contract.contractCode || contract._id}`,
          reference: contract.contractCode || '',
          lineItems: [
            {
              productName: `Coworking Space Rental (${currentPeriod})`,
              quantity: 1,
              rate: rent,
              rateReliable: rent > 0,
              hsnSac: '997212',
            },
          ],
        },
      };
    }

    if (booking) {
      const price = typeof booking.price === 'number' && booking.price > 0 ? booking.price : 0;
      return {
        billingType: 'COWORKING',
        billingEntityCode: '',
        sourceRef: {
          source: 'THE_OFFICE_ON_RENT_CRM',
          sourceType: 'coworking-booking',
          sourceId: String(booking._id),
          billingPurpose: 'BOOKING',
          billingPeriod: '',
        },
        prefill: {
          notes: `Booking: ${booking.bookingCode || booking._id}`,
          reference: booking.bookingCode || '',
          lineItems: [
            {
              productName: `Coworking Booking - ${booking.bookingCode || ''}`,
              quantity: 1,
              rate: price,
              rateReliable: price > 0,
              hsnSac: '997212',
            },
          ],
        },
      };
    }

    const board = await Board.findOne({ companyId }).lean();
    const entityIdStr = String(entity._id || entity);
    const cabin = board?.state?.cabins?.find(c =>
      c.status === 'BOOKED' && (
        String(c.client?.canonicalClientId) === entityIdStr
        || String(c.client?.id) === entityIdStr
        || (entity.companyName && c.client?.companyName?.toLowerCase() === entity.companyName.toLowerCase())
        || (entity.name && c.client?.name?.toLowerCase() === entity.name.toLowerCase())
      )
    );

    if (cabin) {
      const rent = Number(cabin.contract?.monthlyRent ?? cabin.monthlyRent ?? 0);
      const cabinLabel = cabin.label || cabin.code;
      const agreementId = cabin.contract?.id || '';
      return {
        billingType: 'COWORKING',
        billingEntityCode: '',
        sourceRef: {
          source: 'THE_OFFICE_ON_RENT_CRM',
          sourceType: 'board',
          sourceId: `${cabin.code}:${agreementId || currentPeriod}`,
          billingPurpose: 'RENT',
          billingPeriod: currentPeriod,
        },
        prefill: {
          notes: `Cabin: ${cabinLabel} (${cabin.seats} Seater) | Agreement: ${agreementId} | Client: ${entity.companyName || entity.name}`,
          reference: agreementId || cabin.code,
          lineItems: [
            {
              productName: `Coworking Space Rental - Cabin ${cabinLabel} (${cabin.seats} Seats) - ${currentPeriod}`,
              quantity: 1,
              rate: rent,
              rateReliable: rent > 0,
            },
          ],
        },
      };
    }

    return {
      billingType: 'COWORKING',
      billingEntityCode: '',
      sourceRef: {
        source: 'THE_OFFICE_ON_RENT_CRM',
        sourceType: 'coworking-client',
        sourceId: String(entity._id),
        billingPurpose: 'COWORKING_SERVICE',
        billingPeriod: '',
      },
      prefill: {
        notes: `Client: ${entity.companyName || entity.name}`,
        reference: '',
        lineItems: [
          {
            productName: 'Coworking Services',
            quantity: 1,
            rate: 0,
            rateReliable: false,
          },
        ],
      },
    };
  }

  return null;
}

module.exports = { externalId, modelFor, validBookedCabin, loadEligible, customerPayload, fingerprint, buildBillingContext };
