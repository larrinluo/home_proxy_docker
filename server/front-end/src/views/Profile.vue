<template>
  <div class="profile">
    <h1>个人中心</h1>
    <el-card>
      <el-tabs v-model="activeTab">
        <el-tab-pane label="修改密码" name="password">
          <el-form
            ref="passwordFormRef"
            :model="passwordForm"
            :rules="passwordRules"
            label-width="120px"
            style="max-width: 500px"
          >
            <el-form-item label="旧密码" prop="oldPassword">
              <el-input
                v-model="passwordForm.oldPassword"
                type="password"
                placeholder="请输入旧密码"
              />
            </el-form-item>
            <el-form-item label="新密码" prop="newPassword">
              <el-input
                v-model="passwordForm.newPassword"
                type="password"
                placeholder="请输入新密码"
              />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="handleChangePassword" :loading="passwordLoading">
                修改密码
              </el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>
        <el-tab-pane label="更新信息" name="info">
          <el-form
            ref="infoFormRef"
            :model="infoForm"
            :rules="infoRules"
            label-width="120px"
            style="max-width: 500px"
          >
            <el-form-item label="用户名">
              <el-input v-model="infoForm.username" disabled />
            </el-form-item>
            <el-form-item label="邮箱" prop="email">
              <el-input v-model="infoForm.email" placeholder="请输入邮箱" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="handleUpdateInfo" :loading="infoLoading">
                更新信息
              </el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { useAuthStore } from '../stores/auth';
import { changePassword, updateProfile } from '../api/users';

const authStore = useAuthStore();
const activeTab = ref('password');
const passwordFormRef = ref(null);
const infoFormRef = ref(null);
const passwordLoading = ref(false);
const infoLoading = ref(false);

const passwordForm = reactive({
  oldPassword: '',
  newPassword: ''
});

const infoForm = reactive({
  username: '',
  email: ''
});

const passwordRules = {
  oldPassword: [{ required: true, message: '请输入旧密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, max: 50, message: '密码长度在6到50个字符', trigger: 'blur' }
  ]
};

const infoRules = {
  email: [{ type: 'email', message: '请输入正确的邮箱地址', trigger: 'blur' }]
};

onMounted(async () => {
  await authStore.fetchUser();
  if (authStore.user) {
    infoForm.username = authStore.user.username || '';
    infoForm.email = authStore.user.email || '';
  }
});

async function handleChangePassword() {
  if (!passwordFormRef.value) return;
  
  await passwordFormRef.value.validate(async (valid) => {
    if (valid) {
      passwordLoading.value = true;
      try {
        await changePassword({
          oldPassword: passwordForm.oldPassword,
          newPassword: passwordForm.newPassword
        });
        ElMessage.success('密码修改成功');
        passwordForm.oldPassword = '';
        passwordForm.newPassword = '';
      } catch (error) {
        ElMessage.error('密码修改失败');
      } finally {
        passwordLoading.value = false;
      }
    }
  });
}

async function handleUpdateInfo() {
  if (!infoFormRef.value) return;
  
  await infoFormRef.value.validate(async (valid) => {
    if (valid) {
      infoLoading.value = true;
      try {
        await updateProfile({
          email: infoForm.email
        });
        ElMessage.success('更新成功');
        await authStore.fetchUser();
      } catch (error) {
        ElMessage.error('更新失败');
      } finally {
        infoLoading.value = false;
      }
    }
  });
}
</script>

<style scoped>
.profile {
  padding: 20px;
}
</style>

