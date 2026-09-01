const FORMULA_PREFIX_PATTERN = /^[\s]*[=+\-@]/;

export const neutralizeCsvFormulaValue = (value) => {
  const text = String(value ?? "");
  return FORMULA_PREFIX_PATTERN.test(text) ? `'${text}` : text;
};

export const escapeCsvValue = (value) =>
  `"${neutralizeCsvFormulaValue(value).replace(/"/g, '""')}"`;
