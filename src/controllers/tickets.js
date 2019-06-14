const mongoose = require('mongoose')
const validator = require('validator')
const h2p = require('html2plaintext')
const Ticket = mongoose.model('Ticket')
const Download = mongoose.model('Download')
const Other = mongoose.model('Other')

const validateTicket = (input) => {
  if (input === null || !input) {
    return ['error', {name:'Missing', missing: 'No Ticket Data'}]
	} else if(validator.isEmpty(input.user) || validator.isEmpty(input.subject)) {
    return ['error', {name:'Missing', missing: 'Ticket Field'}]
	} else if(!validator.isEmail(input.user)) {
    return ['error', {name:'ValidatorError', type:'Email', attempt: input.user}]
  } else {
    let validatedDoc = {
      user: '',
      staff: '',
      thread_id: '',
      priority: 'Normal',
      status: 'New',
      kind: '',
      info: '',
      subject: ''
    }

    validatedDoc.user = validator.normalizeEmail(input.user)
    if (input.staff !== '') {
      validatedDoc.staff = validator.trim(input.staff)
      validatedDoc.staff = validator.escape(validatedDoc.staff)
      validatedDoc.staff = validator.blacklist(validatedDoc.staff, '$')
    }

    validatedDoc.thread_id = input.thread_id ? input.thread_id : ''

    validatedDoc.priority = validator.isIn(input.priority, ['Low', 'Normal', 'Medium', 'High', 'Urgent']) ? input.priority : 'Normal'
    validatedDoc.status = validator.isIn(input.status, ['New', 'Seen', 'In Progress', 'On Hold', 'Awaiting Reply', 'Completed', 'Closed', 'Reopened']) ? input.status : 'New'
    validatedDoc.kind = validator.isIn(input.kind, ['Download', 'Error', 'Other']) ? input.kind : 'Other'

    validatedDoc.info = input.info ? input.info : ''

    validatedDoc.subject = validator.trim(input.subject)
    validatedDoc.subject = validator.escape(validatedDoc.subject)
    validatedDoc.subject = validator.blacklist(validatedDoc.subject, '$')

    return ['success', validatedDoc]
  }
}

const validateLog = (input) => {
  if (input === null || !input) {
    return ['error', {name:'Missing', missing: 'No Message Data'}]
  } else if(validator.isEmpty(input.type) || validator.isEmpty(input.staff) || validator.isEmpty(input.note)) {
    return ['error', {name:'Missing', missing: 'Log Field'}]
  } else {
    let validatedDoc = {
      type: '',
      date: '',
      message_id: '',
      staff: '',
      note: ''
    }

    validatedDoc.type = validator.trim(input.type)
    validatedDoc.type = validator.escape(validatedDoc.type)
    validatedDoc.type = validator.blacklist(validatedDoc.type, '$')

    validatedDoc.date = input.date ? validator.toDate(input.date) : Date.now()

    validatedDoc.message_id = input.message_id ? input.message_id : ''

    validatedDoc.staff = validator.trim(input.staff)
    validatedDoc.staff = validator.escape(validatedDoc.staff)
    validatedDoc.staff = validator.blacklist(validatedDoc.staff, '$')

    validatedDoc.note = validator.trim(input.note)
    validatedDoc.note = validator.escape(validatedDoc.note)
    validatedDoc.note = validator.blacklist(validatedDoc.note, '$')

    return ['success', validatedDoc]
  }
}

const parseEmail = (ticket, log) => {
  let parsedTicket = ticket;
  let parsedLog = log;
  const regex_email = /<(.*)>/g;
  const regex_email_desc = /Email: (.*)./g;
  const regex_name  = /Name: (.*)./g;
  const regex_title = /Title: (.*)./g;
  const regex_org   = /Organization: (.*)./g;
  const regex_use   = /Use: (.*)./g;

  const user = regex_email.exec(ticket.user);
  if (user) {
    // gets email if the gmail is formatted "Some Name <name@email.com>"
    parsedTicket.user = user[1]
  } else {
    parsedTicket.user = ticket.user
  }

  if (ticket.subject === 'Request for TRM' || ticket.subject === 'Re: Request for TRM' || ticket.subject === 'Fwd: Request for TRM') {
    parsedTicket.kind = 'Download';
    let desc = h2p(log.desc);
    parsedLog.note = desc;
    const name = regex_name.exec(desc);
    const title = regex_title.exec(desc);
    const org = regex_org.exec(desc);
    const use = regex_use.exec(desc);
    if (name) {
      parsedLog.name = name[1]
    } else {
      return ['error', {name:'Missing', missing: 'Name of Requestor', provided:desc}]
    }
    if (title) {
      parsedLog.title = title[1]
    } else {
      return ['error', {name:'Missing', missing: 'Title of Requestor', provided:desc}]
    }
    if (org) {
      parsedLog.organization = org[1]
    } else {
      return ['error', {name:'Missing', missing: 'Organization of Requestor', provided:desc}]
    }
    if (use) {
      parsedLog.use = use[1]
    } else {
      return ['error', {name:'Missing', missing: 'Intended Use', provided:desc}]
    }

    if(!validator.isEmail(parsedTicket.user) || parsedTicket.user == 'itre-information@ncsu.edu') {
      const email = regex_email_desc.exec(desc);
      if (!email) {
        return ['error', {name:'Missing', missing: 'Name of Requestor', provided:desc}]
      } else if (!validator.isEmail(email[1])) {
        return ['error', {name:'ValidatorError', type:'Email', attempt: parsedTicket.user}]
      } else {
        parsedTicket.user = email[1]
      }
    }
  } else {
    if(!validator.isEmail(parsedTicket.user) || parsedTicket.user == process.env.email) {
      const email = regex_email_desc.exec(h2p(log.desc));
      if (!email) {
        return ['error', {name:'Missing', missing: 'Name of Requestor', provided:desc}]
      } else if (!validator.isEmail(email[1])) {
        return ['error', {name:'ValidatorError', type:'Email', attempt: parsedTicket.user}]
      } else {
        parsedTicket.user = email[1]
        log.desc = log.desc.replace(`Email: ${parsedTicket.user}`, "")
        log.desc = log.desc.replace('\n', ' ').replace('u','')
      }
    }

    parsedTicket.kind = 'Other';
    if(h2p(log.desc)) {
      parsedLog.note = h2p(log.desc);
      parsedLog.use = h2p(log.desc);
    } else {
      parsedLog.note = 'Message Was Blank';
      parsedLog.use = 'Message Was Blank';
    }
  }


  return ['success', {parsedTicket, parsedLog}]
}

const validateSubTicket = (kind, input) => {
  let validatedDoc = {}

  switch (kind) {
    case "Download":
      validatedDoc.name = validator.trim(input.name)
      validatedDoc.name = validator.escape(input.name)
      validatedDoc.name = validator.blacklist(validatedDoc.name, '$')

      validatedDoc.title = validator.trim(input.title)
      validatedDoc.title = validator.escape(validatedDoc.title)
      validatedDoc.title = validator.blacklist(validatedDoc.title, '$')

      validatedDoc.organization = validator.trim(input.organization)
      validatedDoc.organization = validator.escape(validatedDoc.organization)
      validatedDoc.organization = validator.blacklist(validatedDoc.organization, '$')

      validatedDoc.use = validator.trim(input.use)
      validatedDoc.use = validator.escape(validatedDoc.use)
      validatedDoc.use = validator.blacklist(validatedDoc.use, '$')
      break
    case "Other":
      validatedDoc.desc = validator.trim(input.use)
      validatedDoc.desc = validator.escape(validatedDoc.desc)
      validatedDoc.desc = validator.blacklist(validatedDoc.desc, '$')
      break
    default:
      return ['error', {name:'Missing', missing: "No Valid Kind"}]
  }
  return ['success', validatedDoc]
}


exports.new_request = function(req, res, next) {
	let validatedDoc = validateSubTicket(req.body.ticket.kind, req.body.kind)
  if (validatedDoc[0] == 'error') {
    return next(validatedDoc[1])
  }
  let sub_ticket
  switch (req.body.ticket.kind) {
    case "Download":
      sub_ticket = new Download(validatedDoc)
      break
    case "Other":
      sub_ticket = new Other(validatedDoc)
      break
    default:
      return next({name:'Kind'})
  }
  sub_ticket.save(function(err, doc) {
    if (err) {
      return next(err)
    }
    validatedDoc = validateTicket(req.body.ticket)
    if (validatedDoc[0] == 'error') {
      return next(validatedDoc[1])
    }
    validatedDoc[1].info = doc._id
    const new_ticket = new Ticket(validatedDoc[1])
    new_ticket.save(function(err, ticket) {
      if (err) {
				return next(err)
      }
      return res.status(201).send({success: true, data: [ticket, doc], req: req.body})
    })
  })
}

exports.update_request = function(req, res, next) {
  let validatedDoc = validateTicket(req.body.ticket)
  if (validatedDoc[0] == 'error') {
    return next(validatedDoc[1])
  }
  let validatedLog = validateLog(req.body.log)
  if (validatedLog[0] == 'error') {
    return next(validatedLog[1])
  }
  Ticket.findOneAndUpdate(
    {"_id": req.params.id},
    { $set: validatedDoc[1], $push: {log: validatedLog[1]} },
    { upsert: true, new: true }
  )
  .populate('info')
  .exec(function(err, ticket) {
    if (err) {
			err.name = 'UpdateError'
      return next(err)
    }
    return res.status(201).send({success: true, msg: "Ticket Successfully Updated.", data: ticket})
  })
}

exports.get_ticket = function(req, res, next) {
	Ticket.find({"_id": req.params.id})
  .populate('info')
  .exec(function(err, doc) {
    if (err) {
			err.name = 'FindError'
      return next(err)
    }
    return res.status(200).send({success: true, data: doc})
  })
}

exports.list_tickets = function(req, res, next) {
	Ticket.find({})
  .populate('info')
  .exec(function(err, docs) {
    if (err) {
			err.name = 'FindError'
      return next(err)
    }
    return res.status(200).send({
      success: true,
      data: docs,
      user:req.body.loggedIn,
      users: req.body.users,
      token: req.body.token
    })
  })
}

exports.list_admin_tickets = function(req, res, next) {
	Ticket.find({$or: [{"staff": req.params.id}, {"staff": ''}]})
  .populate('user')
  .populate('info')
  .exec(function(err, doc) {
    if (err) {
			err.name = 'FindError'
      return next(err)
    }
    return res.status(200).send({success: true, data: doc})
  })
}

exports.delete_tickets = function(req, res, next) {
  if (req.params.id === 'all') {
    Ticket.deleteMany({}, function(err, admin) {
      if (err) {
  			return next(err)
  		}
      return res.status(200).send({ message: 'All Tickets Successfully Deleted' })
    })
  } else if(validator.isEmpty(req.params.id)) {
    return next({name:'Missing'})
  }  else {
    Ticket.deleteOne({
      "_id": req.params.id
    }, function(err, admin) {
      if (err) {
  			return next(err)
  		}
      return res.status(200).send({ message: 'Ticket successfully deleted' })
    })
  }
}

/*****************************
* Handle Fetched New Mail
*****************************/

exports.check_thread = async function(req, res, next) {
  if(req.body.loggedIn.role !== 'Admin') {
    return next()
  }
//  if (req.body.responses.length)
  for (let i = 0; i < req.body.responses.length; i++) {
    console.log('sorting...')
    if (req.body.responses[i].ticket.skip) {
      console.log('spam message skipped')
      continue
    }
    let doc = await Ticket.find({'thread_id': req.body.responses[i].ticket.thread_id}).limit(1)
    if (doc.length > 0) {
// handle update
      console.log('updating...')
      let validatedEmail = parseEmail(req.body.responses[i].ticket, req.body.responses[i].log)
      if (validatedEmail[0] == 'error') {
        return next(validatedEmail[1])
      }
      let {parsedTicket, parsedLog} = validatedEmail[1]
      let validatedLog = validateLog(parsedLog)
      if (validatedLog[0] == 'error') {
        return next(validatedLog[1])
      }
      doc[0].log.push(validatedLog[1])
      try {
        let tic = await doc[0].save()
      } catch (err) {
        return next(err)
      }
      console.log('updated')
    } else {
// add to db
      console.log('adding...')
      let validatedEmail = parseEmail(req.body.responses[i].ticket, req.body.responses[i].log)
      if (validatedEmail[0] == 'error') {
        return next(validatedEmail[1])
      }
      let {parsedTicket, parsedLog} = validatedEmail[1]
      let validatedDoc = validateSubTicket(parsedTicket.kind, parsedLog)
      if (validatedDoc[0] == 'error') {
        return next(validatedDoc[1])
      }
      let sub_ticket
      switch (parsedTicket.kind) {
        case "Download":
          sub_ticket = new Download(validatedDoc[1])
          break
        case "Other":
          sub_ticket = new Other(validatedDoc[1])
          break
        default:
          return next({name:'Kind'})
      }
      try {
        let doc = await sub_ticket.save()
        validatedDoc = validateTicket(parsedTicket)
        if (validatedDoc[0] == 'error') {
          return next(validatedDoc[1])
        }
        validatedDoc[1].info = doc._id
        const new_ticket = new Ticket(validatedDoc[1]);
        let tic = await new_ticket.save()
      } catch (err) {
        return next(err)
      }
      console.log('added')
    }
    console.log('sorted')
  }
  return next()
}
