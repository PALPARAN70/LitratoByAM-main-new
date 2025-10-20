//----------------User Management----------------//
/**
 * Aggregated Admin Controller
 * This file now simply re-exports functions from the split controllers:
 *  - adminBookingController.js (booking management)
 *  - adminUserController.js (user management)
 *  - adminInventoryController.js (inventory, packages, logs, material types)
 * Keeping the original export names to avoid touching route files immediately.
 */
const userCtrl = require('./adminUserController')
const inventoryCtrl = require('./adminInventoryController')

module.exports = {
  // User Management
  getDashboard: userCtrl.getDashboard,
  manageUsers: userCtrl.manageUsers,
  createUser: userCtrl.createUser,
  listUsers: userCtrl.listUsers,
  blockUser: userCtrl.blockUser,
  unblockUser: userCtrl.unblockUser,
  updateUserRole: userCtrl.updateUserRole,
  fetchUserByEmail: userCtrl.fetchUserByEmail,
  // Inventory & Packages & Material Types
  createInventoryItem: inventoryCtrl.createInventoryItem,
  listInventory: inventoryCtrl.listInventory,
  updateInventoryItem: inventoryCtrl.updateInventoryItem,
  deleteInventoryItem: inventoryCtrl.deleteInventoryItem,
  listMaterialTypes: inventoryCtrl.listMaterialTypes,
  createMaterialType: inventoryCtrl.createMaterialType,
  createPackage: inventoryCtrl.createPackage,
  listPackages: inventoryCtrl.listPackages,
  listArchivedPackages: inventoryCtrl.listArchivedPackages,
  updatePackage: inventoryCtrl.updatePackage,
  deletePackage: inventoryCtrl.deletePackage,
  createPackageInventoryItem: inventoryCtrl.createPackageInventoryItem,
  listPackageInventoryItems: inventoryCtrl.listPackageInventoryItems,
  updatePackageInventoryItem: inventoryCtrl.updatePackageInventoryItem,
  deletePackageInventoryItem: inventoryCtrl.deletePackageInventoryItem,
  createInventoryStatusLog: inventoryCtrl.createInventoryStatusLog,
  listInventoryStatusLogs: inventoryCtrl.listInventoryStatusLogs,
  listInventoryStatusLogsByEntity:
    inventoryCtrl.listInventoryStatusLogsByEntity,
  updateInventoryStatusLog: inventoryCtrl.updateInventoryStatusLog,
  deleteInventoryStatusLog: inventoryCtrl.deleteInventoryStatusLog,
  listPackageItemsForPackage: inventoryCtrl.listPackageItemsForPackage,
  replacePackageItems: inventoryCtrl.replacePackageItems,
}
