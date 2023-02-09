const express = require('express');
const viewsController = require('../controllers/viewsController');
const authController = require('../controllers/authController');

const router = express.Router();
//stap 3
//And so, this is a middleware function,which will basically run for each and every single request that's coming into this router,so basically for all the requests to our website.
router.use(viewsController.alerts);

router.get('/', authController.isLoggedIn, viewsController.getOverview);
router.get('/tour/:slug', authController.isLoggedIn, viewsController.getTour);
router.get('/login', authController.isLoggedIn, viewsController.getLoginForm);
router.get('/me', authController.protect, viewsController.getAccount);

//!!!!!!!!
router.get(
  '/my-tours',

  authController.protect,
  viewsController.getMyTours
);

module.exports = router;
