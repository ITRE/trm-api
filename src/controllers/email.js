
const nodemailer = require('nodemailer')
const googleAuth = require('google-auth-library')
const {auth} = require('google-auth-library')
const validator = require('validator')
const {google} = require('googleapis')
const { Base64 } = require('js-base64')

const mongoose = require('mongoose')
const User = mongoose.model('User')
const Admin = mongoose.model('Admin')

/*
* Define Exponential Backoff Timer
*/

const delay = ms => new Promise(res => setTimeout(res, ms))
let backoffTime = 1


/*
*   Gmail Generic Client Functions
*/

const authClient = new googleAuth.OAuth2Client(
  process.env.client,
  process.env.secret,
  process.env.redirect
)

async function authenticate() {
  authClient.setCredentials({
     refresh_token: process.env.refresh
  })
  const tokens = await authClient.getAccessToken()
  authClient.setCredentials({
    access_token: tokens.token,
    refresh_token: process.env.refresh
  })
  return authClient
}

async function getFiles(id) {
  const drive = google.drive({
    version: 'v3',
    auth: authClient
  })
  if (!drive) {
    return ['error', {name: 'AuthError'}]
  }
  const file = await drive.files.get(id);
  return ['success', file]
}

// Send email
async function sendMail(email) {
  const gmail = google.gmail({
    version: 'v1',
    auth: authClient
  })

  const subject = email.subject
  const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`
  const messageParts = [
    `From: ${email.from}`,
    `To: ${email.to}`,
    `Content-Type: text/html; charset=utf-8`,
    `MIME-Version: 1.0`,
    `Subject: ${utf8Subject}`,
    ``,
    email.message
  ]
  const message = messageParts.join('\n')

  // The body needs to be base64url encoded.
  const encodedMessage = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const res = await gmail.users.messages.send({
    'userId': 'me',
    'resource': {
      'raw': encodedMessage,
      'threadID': email.thread_id
    },
  })
  console.log(res.data)
  return res.data
}

// Send email with attachment
async function sendData(email, files, backoffTime = 1) {
  const gmail = google.gmail({
    version: 'v1',
    auth: authClient
  })
  if (!gmail) {
    return ['error', {name: 'AuthError'}]
  }
  if (!files) {
    return ['error', {name: 'Missing', type: 'No File Info Provided'}]
  }
  console.log(files)
  const file = await getFiles({fileId: files.fileID}).catch(err=>{
    return ['error', {name: 'FileError', response: err}]
  })
//drive.google.com/file/d/15FyXi1fZx8gaxocBsYiXgaI-tnpsDTak/view?usp=sharing
  let to = []
  if (email.cc) {
    to.push(`CC: ${email.cc}`)
  }
  if (email.bcc) {
    to.push(`BCC: ${email.bcc}`)
  }
  if (email.to) {
    to.push(`To: ${email.to}`)
  }
  const messageParts = [
    `From: ${email.from}`,
    to,
    `Content-Type: multipart/mixed; boundary="boundary"`,
    `MIME-Version: 1.0`,
    `Subject: ${email.subject}`,
    ``,
    email.message
  ]
  if (file[0] === 'success') {
    console.log(file[1].data)
    messageParts.push(`https://drive.google.com/open?id=${file[1].data.id}`)
  } else {
    return ['error', {name: 'FileError', response: file}]
  }
  const message = messageParts.join('\n')

  const res = await gmail.users.messages.send({
    'userId': 'me',
    'resource': {
      'threadID': email.thread_id
    },
    'media': {
      'mimeType': 'message/rfc822',
      'body': message
    }
  })
  if (!res.data) {
    return ['error', {name: 'Mail'}]
  }
  //console.log(res.data)
  return ['success', res.data]
}

// Get new emails
async function fetchMail() {
  const gmail = google.gmail({
    version: 'v1',
    auth: authClient
  })
// get ID list
  const list = await gmail.users.messages.list({
    'userId': 'me',
    'q': 'is:unread'
  })
  let response = []
  let ids = []
  if(list.data.messages) {
    for (let message of list.data.messages) {
      ids.push(message.id)
      let res = await fetchResponse(message.id)
      response.push(res)
    }
    await batchMarkRead(ids)
  }

  return response
}

// Get mail by id
async function fetchResponse(id) {
  const gmail = google.gmail({
    version: 'v1',
    auth: authClient
  })

  const response = await gmail.users.messages.get({
    'userId': 'me',
    'id': id
  })

  let ticket = {
    user: '',
    staff: '',
    thread_id: response.data.threadId,
    priority: 'Normal',
    status: 'New',
    kind: 'Other',
    subject: ''
  }
  let log = {
    note: ``,
    date: '',
    type: 'Response',
    staff: 'N/A',
    message_id: response.data.id,
    attachments: false
  }

  for (let head of response.data.payload.headers) {
    switch (head.name) {
      case 'Auto-Submitted':
        ticket = {skip:true}
        return {ticket, log}
        break
      case 'From':
        if (head.value.includes('google')){
          ticket = {skip:true}
          return {ticket, log}
        }
        ticket.user = head.value
        break;
      case 'Subject':
        ticket.subject = head.value
        break;
      case 'Date':
        log.date = head.value
        break;
      default:
        continue;
    }
  }

  if (response.data.payload.parts) {
    for (let part of response.data.payload.parts) {
      if (part.filename && part.filename.length > 0) {
        log.attachments = true
      } else if (!part.body.data) {
        continue
      } else {
        log.desc += Base64.decode(part.body.data)
      }
    }
  } else if (response.data.payload.body.data) {
    log.desc = Base64.decode(response.data.payload.body.data)
  } else {
    console.log(response.data)
  }
  return {ticket, log}
}

async function batchMarkRead(ids) {
  const gmail = google.gmail({
    version: 'v1',
    auth: authClient
  })
  await gmail.users.messages.batchModify({
    'userId': 'me',
    'resource': {
      'ids': ids,
      'removeLabelIds': ['UNREAD']
    }
  }).catch(err => console.log(err))
  return
}


/*
*   Email Route Functions
*/

// Get New Messages
exports.fetch_responses = function(req, res, next) {
  if(req.body.loggedIn.role !== 'Admin') {
    return next()
  }
  authenticate()
  .then(fetchMail)
  .then(response => {
    req.body.responses = response
    console.log('fetched', req.body.responses.length)
    return next()
  })
  .catch(err => {
    return next(err)
  })
}

// Send Ticket Response
exports.send_response = function(req, res, next) {
  if (req.body === null || !req.body) {
    return next({name:'Missing'})
	} else if (req.body.email === false) {
    return next()
	} else if(!req.body.ticket.user || !req.body.ticket.subject || !req.body.log.note) {
    return next({name:'Missing'})
	} else if(!validator.isEmail(req.body.ticket.user)) {
    return next({name:'ValidatorError', type:'email', attempt: req.body.ticket.user})
  } else {
    authenticate()
    .then(client => {
      sendMail({
        to: req.body.ticket.user,
        from: 'me',
        subject: req.body.ticket.subject,
        message: req.body.log.note,
        thread_id: req.body.ticket.thread_id ? req.body.ticket.thread_id : ''
      }).then(response => {
        console.log('sent!', response)
        req.body.ticket.thread_id = response.threadId
        req.body.log.message_id = response.id
        next()
      })
      .catch(err => {
        err.name = "EmailError"
        err.sent = {
          to: req.body.ticket.user,
          from: 'me',
          subject: req.body.ticket.subject,
          message: req.body.log.note,
          thread_id: req.body.ticket.thread_id ? req.body.ticket.thread_id : ''
        }
        return next(err)
      })
    })
    .catch(err => {
      err.name = "AuthError"
      return next(err)
    })
  }
}

// Send Password Reset
exports.send_reset = function(req, res, next) {
  const resetToken =  Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
  Admin.findOneAndUpdate({"email": req.body.user},
    {$set: {resetPasswordToken: resetToken, resetPasswordExpires: Date.now() + 3600000}},
    {new: true})
  .exec(function(err, user) {
  	if (err) {
      err.name= 'UpdateError'
  		return next(err)
  	} else if (user === null) {
      return next({name:'NoUser', sent:req.body})
  	} else {
      authenticate()
      .then(client => {
        sendMail({
          to: req.body.user,
          from: process.env.email,
          subject: 'Password Reset',
          message: `You are recieving this email because you requested a reset of your password.
            <br />
            <strong><em>If you did not request this email, please contact your administrator immediately.</em></strong>
            <br /><br />
            Click the link below to reset your password.
            <br /><br />
            <a href="http://localhost:3000/login/${req.body.user}/${resetToken}">Reset My Password</a>`
        }).then(response => {
          return res.status(200).send({success: true, msg: "An email has been sent to your address."})
        })
        .catch(err => {
          return next(err)
        })
      })
      .catch(err => {
        return next(err)
      })
    }
  })
}

// Request Help
exports.request_help = function(req, res, next) {
  if (req.body === null || !req.body) {
    return next({name:'Missing', provided: req})
  } else if(!req.body.email || !req.body.subject || !req.body.desc) {
    return next({name:'Missing'})
	} else if(!validator.isEmail(req.body.email)) {
    return next({name:'ValidatorError', type:'email', attempt: req.body.email})
  } else {
    authenticate()
    .then(client => {
      sendMail({
        to: process.env.email,
        from: req.body.email,
        subject: req.body.subject,
        message: `Email: ${req.body.email}<br /><br />${req.body.desc}`
      }).then(response => {
        return res.status(200).send({status: "request sent", request: req.body.response})
      })
      .catch(err => {
        return next(err)
      })
    })
    .catch(err => {
      return next(err)
    })
  }
}

// Request Download
exports.request_download = function(req, res, next) {
  if (req.body === null || !req.body) {
    return next({name:'Missing', provided: req})
  } else if(!req.body.kind.email)
            || !req.body.kind.organization)
            || !req.body.kind.title)
            || !req.body.kind.use) {
    return next({name:'Missing'})
	} else if(!validator.isEmail(req.body.kind.email)) {
    return next({name:'ValidatorError', type:'email', attempt: req.body.kind.email})
  } else {
    authenticate()
    .then(client => {
      sendMail({
        to: process.env.email,
        from: req.body.kind.email,
        subject: 'Request for TRM',
        message: `This is an automated request from the website for access to TRM.
          <br /><br />
          Name: ${req.body.kind.name}
          <br />
          Email: ${req.body.kind.email}
          <br />
          Organization: ${req.body.kind.organization}
          <br />
          Title: ${req.body.kind.title}
          <br />
          Use: ${req.body.kind.use}
          <br />`
      }).then(response => {
        return res.status(200).send({status: "request sent", request: req.body.response})
      })
      .catch(err => {
        return next(err)
      })
    })
    .catch(err => {
      return next(err)
    })
  }
}

// Send Download
exports.send_download = function(req, res, next) {
  if (req.body === null || !req.body) {
    return next({name:'Missing'})
	} else if (req.body.email === false) {
    return next()
	} else if(!req.body.ticket.user || !req.body.ticket.subject || !req.body.log.note) {
    return next({name:'Missing'})
	} else if(!validator.isEmail(req.body.ticket.user)) {
    return next({name:'ValidatorError', type:'email', attempt: req.body.ticket.user})
  } else {
    authenticate()
    .then(client => {
      sendData({
        to: req.body.ticket.user,
        from: 'me',
        subject: req.body.ticket.subject,
        message: `Thank you for requesting the Triangle Regional Management tool.
          <br />
          Attached are the requested files.
          <br />
          Please do not respond to this email.
          <br />
          Thank you!
          <br />`,
        thread_id: req.body.ticket.thread_id ? req.body.ticket.thread_id : ''
      }, req.body.files).then(response => {
        if (response[0] === 'success') {
          console.log('Download Sent')
          req.body.ticket.thread_id = response[1].threadId
          req.body.log.message_id = response[1].id
          next()
        } else {
          next(response[1])
        }
      })
      .catch(err => {
        backoffTime *= 2
        console.log(err)
        return delay(backoffTime)
      })
    })
    .catch(err => {
      err.name = "AuthError"
      return next(err)
    })
  }
}

// Send Updated Download
exports.send_new_download = function(req, res, next) {
  if (req.body === null || !req.body) {
    return next({name:'Missing'})
	} else if (req.body.email === false) {
    next()
  } else {
    let users = []
    for (let i=0; i<req.body.users.length;i++) {
      users.push(req.body.users[i].email)
    }
    authenticate()
    .then(client => {
      sendData({
        bcc: users,
        from: 'me',
        subject: `New Download - Version ${req.body.files.version}`,
        message: `As a user of the Triangle Regional Management tool, we wanted to let you know about our latest update.
          <br />
          Attached are the files for version ${req.body.files.version}.
          <br />
          We hope you'll find it better than ever.
          <br />
          <br />
          Please do not respond to this email.
          <br />`,
        thread_id: ''
      }, req.body.files).then(response => {
        if (response[0] === 'success') {
          console.log('Download Sent')
          next()
        } else {
          next(response[1])
        }
      })
      .catch(err => {
        backoffTime *= 2
        console.log(err)
        return delay(backoffTime)
      })
    })
    .catch(err => {
      err.name = "AuthError"
      return next(err)
    })
  }
}
