//use for create tables

const { initUserTable } = require('./Model/userModel')
const { initInventoryTable } = require('./Model/inventoryModel')
const { initPackagesTable } = require('./Model/packageModel')
const {
  initPackageInventoryItemsTable,
} = require('./Model/packageInventoryItemModel')
const {
  initInventoryStatusLogTable,
} = require('./Model/inventoryStatusLogModel')

// Initialize all tables
async function initAll() {
  await initUserTable()
  await initInventoryTable()
  await initPackagesTable()
  await initPackageInventoryItemsTable()
  await initInventoryStatusLogTable()
}

module.exports = { initAll }
