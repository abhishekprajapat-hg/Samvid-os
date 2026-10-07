const normalize = (value) => String(value || "").trim().toUpperCase();

const hasUnpaidPartialCollection = (lead) =>
  normalize(lead?.status) === "CLOSED"
  && normalize(lead?.dealPayment?.paymentType) === "PARTIAL"
  && Number(lead?.dealPayment?.remainingAmount) > 0;

const shouldClearTerminalFollowUp = (status, lead) => {
  const normalizedStatus = normalize(status);
  return normalizedStatus === "LOST"
    || normalizedStatus === "INVALID"
    || (normalizedStatus === "CLOSED" && !(
      normalize(lead?.dealPayment?.paymentType) === "PARTIAL"
      && Number(lead?.dealPayment?.remainingAmount) > 0
    ));
};

module.exports = { hasUnpaidPartialCollection, shouldClearTerminalFollowUp };
