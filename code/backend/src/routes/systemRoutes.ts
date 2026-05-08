import { Router } from 'express';
import * as userController from '../controllers/userController';
import * as roleController from '../controllers/roleController';
import * as permissionController from '../controllers/permissionController';
import * as menuController from '../controllers/menuController';

const router = Router();

// ==================== 用户管理 ====================
router.get('/users', userController.listUsers);
router.get('/users/:id', userController.getUser);
router.post('/users', userController.createUser);
router.put('/users/:id', userController.updateUser);
router.delete('/users/:id', userController.deleteUser);
router.put('/users/:id/roles', userController.updateUserRoles);

// ==================== 角色管理 ====================
router.get('/roles', roleController.listRoles);
router.get('/roles/all', roleController.getAllRoles);
router.get('/roles/:id', roleController.getRole);
router.post('/roles', roleController.createRole);
router.put('/roles/:id', roleController.updateRole);
router.delete('/roles/:id', roleController.deleteRole);

// ==================== 权限管理 ====================
router.get('/permissions', permissionController.listPermissions);
router.get('/permissions/all', permissionController.getAllPermissions);
router.get('/permissions/:id', permissionController.getPermission);
router.post('/permissions', permissionController.createPermission);
router.put('/permissions/:id', permissionController.updatePermission);
router.delete('/permissions/:id', permissionController.deletePermission);

// ==================== 菜单管理 ====================
router.get('/menus', menuController.listMenus);
router.get('/menus/tree', menuController.getMenuTree);
router.get('/menus/:id', menuController.getMenu);
router.post('/menus', menuController.createMenu);
router.put('/menus/:id', menuController.updateMenu);
router.delete('/menus/:id', menuController.deleteMenu);

export default router;
