import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUserStore = defineStore('user', () => {
  const userInfo = ref({
    name: '管理员',
    avatar: '',
    role: 'admin'
  })

  const isLoggedIn = ref(true)

  function setUserInfo(info: Partial<typeof userInfo.value>) {
    userInfo.value = { ...userInfo.value, ...info }
  }

  function logout() {
    isLoggedIn.value = false
    userInfo.value = { name: '', avatar: '', role: '' }
  }

  return {
    userInfo,
    isLoggedIn,
    setUserInfo,
    logout
  }
})
