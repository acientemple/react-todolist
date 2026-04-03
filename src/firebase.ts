import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, push, remove, onValue, off } from 'firebase/database';

// Firebase 配置
const firebaseConfig = {
  projectId: 'snake-game-6e39e',
  databaseURL: 'https://snake-game-6e39e-default-rtdb.asia-southeast1.firebasedatabase.app/'
};

// 初始化 Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// 数据路径前缀 - todolist 专用
const TODO_PATH = 'todolist/';

// 简单哈希函数
export const simpleHash = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
};

// 用户接口
export interface User {
  username: string;
  password: string;
  isAdmin: boolean;
  created: string;
}

// Firebase 数据库操作 - todolist 专用
export const FirebaseDB = {
  // 获取所有数据
  async getAll() {
    const snapshot = await get(ref(database, TODO_PATH));
    return snapshot.val() || { users: {} };
  },

  // 保存用户
  async saveUser(username: string, userData: User) {
    await set(ref(database, TODO_PATH + 'users/' + username), userData);
  },

  // 读取用户
  async getUser(username: string) {
    const snapshot = await get(ref(database, TODO_PATH + 'users/' + username));
    return snapshot.val();
  },

  // 读取所有用户
  async getAllUsers() {
    const snapshot = await get(ref(database, TODO_PATH + 'users'));
    return snapshot.val() || {};
  },

  // 检查用户名是否存在
  async userExists(username: string) {
    const user = await this.getUser(username);
    return !!user;
  },

  // 删除用户
  async deleteUser(username: string) {
    await remove(ref(database, TODO_PATH + 'users/' + username));
  },

  // 批量保存用户（管理员用）
  async batchSaveUsers(users: Record<string, User>) {
    for (const [key, value] of Object.entries(users)) {
      await set(ref(database, TODO_PATH + 'users/' + key), value);
    }
  }
};

// 认证服务
export const AuthService = {
  // 注册
  async register(username: string, password: string, isAdmin: boolean = false): Promise<{ success: boolean; message: string }> {
    if (!username || !password) {
      return { success: false, message: '用户名和密码不能为空' };
    }
    if (password.length < 3) {
      return { success: false, message: '密码至少3位' };
    }
    if (await FirebaseDB.userExists(username)) {
      return { success: false, message: '用户名已存在' };
    }

    const user: User = {
      username,
      password: simpleHash(password),
      isAdmin,
      created: new Date().toISOString()
    };

    await FirebaseDB.saveUser(username, user);
    return { success: true, message: '注册成功' };
  },

  // 登录
  async login(username: string, password: string): Promise<{ success: boolean; message: string; user?: User }> {
    const user = await FirebaseDB.getUser(username);
    if (!user) {
      return { success: false, message: '用户不存在' };
    }
    if (user.password !== simpleHash(password)) {
      return { success: false, message: '密码错误' };
    }

    // 保存登录状态到 localStorage
    localStorage.setItem('todo-current-user', username);
    localStorage.setItem('todo-admin', user.isAdmin ? 'true' : 'false');

    return { success: true, message: '登录成功', user };
  },

  // 登出
  logout() {
    localStorage.removeItem('todo-current-user');
    localStorage.removeItem('todo-admin');
  },

  // 检查是否已登录
  isLoggedIn(): boolean {
    const username = localStorage.getItem('todo-current-user');
    return !!username;
  },

  // 获取当前用户名
  getCurrentUser(): string | null {
    return localStorage.getItem('todo-current-user');
  },

  // 检查是否是管理员
  isAdmin(): boolean {
    return localStorage.getItem('todo-admin') === 'true';
  },

  // 管理员：设置用户为管理员
  async setAdmin(username: string, isAdmin: boolean) {
    const user = await FirebaseDB.getUser(username);
    if (user) {
      user.isAdmin = isAdmin;
      await FirebaseDB.saveUser(username, user);
    }
  },

  // 管理员：删除用户
  async deleteUser(username: string) {
    await FirebaseDB.deleteUser(username);
  }
};

export { database, ref, set, get, push, remove, onValue, off };
