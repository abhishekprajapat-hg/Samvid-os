/*
 * Turns a Mongoose write failure into the response the client should have got.
 *
 * A missing required field, a bad enum value or an unparseable date is the
 * caller's mistake, but every one of them used to reach a controller's generic
 * catch and come back as 500 "Server error". That hid the real problem from the
 * user ("Server error" instead of "Name is required") and buried genuine 500s
 * in validation noise.
 */

const FRIENDLY_FIELD_NAMES = {
  name: "Name",
  email: "Email",
  phone: "Phone",
  password: "Password",
  title: "Title",
  role: "Role",
  status: "Status",
  priority: "Priority",
  dueDate: "Due date",
};

const labelFor = (path) =>
  FRIENDLY_FIELD_NAMES[path]
  || String(path || "field")
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();

const describeValidationError = (error) => {
  const paths = Object.keys(error.errors || {});
  if (!paths.length) return "Some values are invalid";

  const messages = paths.slice(0, 4).map((path) => {
    const detail = error.errors[path];
    const label = labelFor(path);

    if (detail?.kind === "required") return `${label} is required`;
    if (detail?.kind === "enum") return `${label} has an unsupported value`;
    if (detail?.kind === "minlength") {
      return `${label} must be at least ${detail.properties?.minlength} characters`;
    }
    if (detail?.kind === "maxlength") {
      return `${label} must be at most ${detail.properties?.maxlength} characters`;
    }
    if (detail?.name === "CastError") return `${label} is not a valid ${detail.kind}`;
    if (detail?.kind === "min" || detail?.kind === "max") {
      return `${label} is out of range`;
    }
    return detail?.message || `${label} is invalid`;
  });

  return messages.join("; ");
};

/*
 * Returns { status, message } for a client-caused failure, or null when the
 * error is genuinely ours and should stay a 500.
 */
const toHttpError = (error) => {
  if (!error) return null;

  if (error.name === "ValidationError") {
    return { status: 400, message: describeValidationError(error) };
  }

  if (error.name === "CastError") {
    return { status: 400, message: `${labelFor(error.path)} is not a valid ${error.kind}` };
  }

  // Duplicate key on a unique index.
  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern || error.keyValue || {})[0];
    return {
      status: 409,
      message: field ? `${labelFor(field)} is already in use` : "That record already exists",
    };
  }

  if (error.name === "StrictModeError") {
    return { status: 400, message: "Unrecognised field in request" };
  }

  return null;
};

/*
 * Sends the mapped response when the failure was the caller's, and returns true
 * so the controller can stop. Returns false for a real server fault, leaving
 * the existing 500 path in charge.
 */
const sendMongooseError = (res, error) => {
  const mapped = toHttpError(error);
  if (!mapped) return false;
  res.status(mapped.status).json({ message: mapped.message });
  return true;
};

module.exports = { toHttpError, sendMongooseError, describeValidationError };
