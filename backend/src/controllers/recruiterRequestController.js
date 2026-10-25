const service = require('../services/recruiterRequestService');
const { isValidRequest } = require('../validators/recruiterRequestValidator');

function sendError(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

exports.submit = async (req, res) => {
  if (!isValidRequest(req.body)) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Please check the submitted fields.');
  }
  const { fullName, email, companyName, password } = req.body;
  try {
    const created = await service.createRequest({ fullName, email, companyName, password });
    return res.status(201).json(created);
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      return sendError(res, 409, 'CONFLICT', 'A request with this email already exists.');
    }
    return sendError(res, 500, 'SERVER_ERROR', 'Something went wrong.');
  }
};

exports.listPending = async (req, res) => {
  try {
    return res.status(200).json(await service.listPending());
  } catch (e) {
    return sendError(res, 500, 'SERVER_ERROR', 'Something went wrong.');
  }
};
