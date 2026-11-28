export async function startAuthenticatedCustomerApp({ apiClient, mount, storage, location }) {
  const token = storage.getItem('carbon-ledger-token')
  if (!token) {
    location.replace('/login')
    return false
  }

  try {
    await apiClient.get('/auth/me')
    mount()
    return true
  } catch (error) {
    if (error?.response?.status === 401) {
      location.replace('/login')
      return false
    }
    throw error
  }
}
