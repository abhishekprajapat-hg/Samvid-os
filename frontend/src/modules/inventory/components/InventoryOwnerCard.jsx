import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui";
import { KeyValue } from "./InventoryKeyValue";

/**
 * Owner and key-manager contacts - the commercially sensitive part of a
 * property record.
 *
 * This is the ONE place those fields are rendered, so who can see them is a
 * single decision to audit rather than a scatter of conditionals. A channel
 * partner gets the notice instead, and the values never reach the DOM.
 *
 * Note: the API still sends these fields to partners. Hiding them here keeps
 * them off the screen, not out of the network response - that needs a
 * projection on the inventory endpoint.
 *
 * @param {object}  source        Inventory or asset record.
 * @param {boolean} canViewOwner  False for CHANNEL_PARTNER.
 */
const InventoryOwnerCard = ({ source = {}, canViewOwner }) => {
  if (!canViewOwner) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-[11.5px] text-slate-500 dark:text-slate-400">
            Owner and key-manager contacts are hidden for channel partners.
          </p>
        </CardContent>
      </Card>
    );
  }

  const rows = [
    { label: "Name", value: source?.ownerName },
    { label: "Type", value: source?.ownerType },
    { label: "Phone", value: source?.ownerNumber, mono: true },
    { label: "WhatsApp", value: source?.ownerWhatsapp || source?.ownerNumber, mono: true },
    { label: "Key manager", value: source?.keyManagerName },
    { label: "Key phone", value: source?.keyManagerNumber, mono: true },
  ];

  const hasAny = rows.some((row) => row.value);
  if (!hasAny) return null;

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle>Owner</CardTitle>
      </CardHeader>
      <CardContent>
        <KeyValue rows={rows} labelWidth="96px" />
      </CardContent>
    </Card>
  );
};

export default InventoryOwnerCard;
