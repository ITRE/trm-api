module.exports = function(app) {
  const mongoose = require('mongoose')
  const jwt = require('jsonwebtoken')
  const passport = require('passport')
  const cors = require('cors')

  const users = require('./controllers/user')
	const tickets = require('./controllers/tickets')
	const admin = require('./controllers/admin')
	const email = require('./controllers/email')
	const files = require('./controllers/files')

  app.route('/')
		.get(function(req, res) {
    	return res.status(200).send({status: "running"})
    })

  app.route('/version')
    .post(files.new_version, users.list_users, email.send_new_download, (req, res) => res.status(200).send({status: "download sent"}) )
    .get(files.get_version, (req, res) => res.status(200).send({success: true, data: req.body.files}))

  app.route('/version/:id')
    .get(files.get_specific_version)
    .delete(files.delete_files)

  app.route('/users')
    .get(users.list_users, (req, res) => res.status(200).send({success: true, data: req.body.users}) )
    .post(users.create_user)

  app.route('/users/:id')
    .get(users.view_user)
    .put(users.update_user)
    .delete(users.delete_user)

  app.route('/tickets')
    .post(tickets.new_request)
    .put(email.request_help)
    .get(tickets.list_tickets)

  app.route('/tickets/:id')
    .put(email.send_response, tickets.update_request)
//    .put(tickets.update_request)
    .get(tickets.get_ticket)
    .delete(tickets.delete_tickets)

  app.route('/admin')
    .post(admin.create_admin, admin.login_admin, email.fetch_responses, tickets.check_thread, tickets.list_tickets)
    .get(admin.list_admins)

  app.route('/admin/:id')
    .delete(admin.delete_admin)
    .put(admin.update_admin)
    .get(tickets.list_admin_tickets)

  app.route('/login')
    .post(admin.login_admin, email.fetch_responses, tickets.check_thread, users.list_users, tickets.list_tickets)
    .get(email.send_reset)
    .put(admin.login_reset)

  app.route('/messages')
    //.put(files.get_version, email.send_download, (req, res) => res.status(200).send({status: "download sent"}) )
    .post(email.request_download)
    .get(email.fetch_responses, tickets.check_thread, tickets.list_tickets)

  app.route('/messages/:id')
    .put(users.create_user, files.get_version, email.send_download, tickets.update_request)


  app.route('/testing')
    .post(function(req, res, next) {
      console.log(req.body)
      req.body = 'whooo!'
      next()
    }, function(req, res, next) {
      console.log(req.body)
      res.send('booooy!')
    })
    .get(email.fetch_responses, tickets.check_thread, function(req, res) {
    	return res.status(200).send({status: "running"})
    })


/* Error Handler */
  app.use(function (err, req, res, next) {
    console.log(err)

    switch (err.name) {
      case 'UpdateError':
        return res.status(409).send({
          success: false,
          error: err,
          msg: "An error occurred while attempting to update this resource. Please check than all fields have been filled and that the ObjectID is correct.",
          request: req.body
        })
        break;
      case 'ValidatorError':
        return res.status(409).send({
          success: false,
          error: err,
          msg: `Validation failed on the ${err.type}. Please check that an appropriate value was provided.`,
          request: req.body
        })
        break;
      case 'EmailError':
        return res.status(409).send({
          success: false,
          error: err,
          msg: "The email provided for this user was not valid. Please check your spelling and try again.",
          request: req.body
        })
        break;
      case 'ResetNotValid':
        return res.status(409).send({
          success: false,
          error: err,
          msg: "Your password could not be updated. Please consult your administrator for more information on this error.",
          request: req.body
        })
        break;
      case 'Mail':
        return res.status(500).send({
          success: false,
          error: err,
          msg: "The server was unable to send an email to your address. Please consult your administrator for more information on this error.",
          request: req.body
        })
        break;
      case 'FindError':
        return res.status(404).send({
          success: false,
          error: err,
          msg: "This ID does not match any registered. Please double check the Json Web Token payload.",
          request: req.body
        })
        break;
      case 'FileError':
        return res.status(404).send({
          success: false,
          error: err,
          msg: "The current download version could not be retrieved from Google Drive. Please check the fileID and the permissions for the ticket account.",
          request: req.body.files
        })
        break;
      case 'WrongPass':
        return res.status(403).send({
          success: false,
          error: err,
          msg: "The password entered for this user is incorrect. Please check your spelling and try again.",
          request: req.body
        })
        break;
      case 'AuthError':
        return res.status(403).send({
          success: false,
          error: err,
          msg: "The credentials for this user were not accepted. Please check your spelling and try again.",
          request: req.body
        })
        break;
      case 'PassHash':
        return res.status(500).send({
          success: false,
          error: err,
          msg: "There was an error hashing the provided password.",
          request: req.body
        })
        break;
      case 'Missing':
        return res.status(400).send({
          success: false,
          error: err,
          msg: "This request was missing a parameter",
          request: req.body
        })
        break;
      default:
        return res.status(500).send({
          success: false,
          error: err,
          msg: "Sorry, something's gone wrong. " + err,
          request: req.body
        })
    }
  })
}
