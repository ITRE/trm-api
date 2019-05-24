module.exports = {
  'secret': 'super secret passphrase',
  'database': `mongodb+srv://${process.env.user}:${process.env.pass}@client-wwat7.mongodb.net/${process.env.db}`,
  'local': 'mongodb://localhost:27017/trm',
  'port': process.env.PORT || 8000
}
