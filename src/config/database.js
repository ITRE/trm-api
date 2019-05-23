module.exports = {
  'secret': 'super secret passphrase',
  'database': `mongodb+srv://${process.env.user}:${process.env.pass}@client-wwat7.mongodb.net/${process.env.db}`,
  'port': process.env.PORT || 8000
}
