const router = require('express').Router();
const c = require('../controllers/recruiterRequestController');
const adminOnly = require('../middleware/adminOnly');

router.post('/recruiter-requests', c.submit);
router.get('/admin/recruiter-requests', adminOnly, c.listPending);

module.exports = router;
