import { markRaw } from 'vue'

const acceptedImageTypes = ['image/png', 'image/jpeg', 'image/webp']
const maxImageSize = 10 * 1024 * 1024

export function useProjectInfoEditor({
  draft,
  uploadedImageUrl,
  ProjectInfo,
  projectApi,
  persistence,
  canSave,
  notify,
  saveProjectInfo,
  getSavedProjectDraft,
  setSavedProjectDraft,
  FileCtor = globalThis.File,
  URLRef = globalThis.URL,
  FileReaderCtor = globalThis.FileReader,
}) {
  function handleFileChange(event) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!acceptedImageTypes.includes(file.type)) {
      notify('请选择 PNG、JPG 或 WebP 图片')
      event.target.value = ''
      return
    }
    if (file.size > maxImageSize) {
      notify('图片不能超过 10MB')
      event.target.value = ''
      return
    }
    if (uploadedImageUrl.value) URLRef.revokeObjectURL(uploadedImageUrl.value)
    draft.modelImage = markRaw(file)
    draft.modelImageName = file.name
    uploadedImageUrl.value = URLRef.createObjectURL(file)
    // Keep the File in the draft, while allowing the same image to be selected
    // again after the user removes its preview.
    event.target.value = ''
  }

  function removeUploadedImage() {
    if (uploadedImageUrl.value) URLRef.revokeObjectURL(uploadedImageUrl.value)
    draft.modelImage = null
    draft.modelImageName = ''
    uploadedImageUrl.value = ''
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReaderCtor()
      reader.addEventListener('load', () => {
        if (typeof reader.result === 'string') resolve(reader.result)
        else reject(new Error('The selected image could not be read.'))
      }, { once: true })
      reader.addEventListener('error', () => reject(reader.error ?? new Error('The selected image could not be read.')), { once: true })
      reader.readAsDataURL(file)
    })
  }

  async function saveProjectChanges(event) {
    if (!event.target.reportValidity() || !canSave()) return
    const submittedDraft = { ...draft, accountingStages: [...draft.accountingStages] }
    const projectInfo = { ...submittedDraft }
    return persistence.enqueue(async () => {
      if (typeof FileCtor === 'function' && projectInfo.modelImage instanceof FileCtor) {
        projectInfo.modelImage = await readFileAsDataUrl(projectInfo.modelImage)
      }
      // Only send editable project fields; account/project IDs come from the URL and token.
      const payload = Object.fromEntries(Object.keys(ProjectInfo).filter(key => key !== 'accountingStages').map(key => [key, projectInfo[key]]))
      const { data } = await projectApi.patchProject(payload)
      saveProjectInfo(data)
      setSavedProjectDraft(submittedDraft)
      return data
    }, true, () => notify('项目信息已保存'))
  }

  return {
    handleFileChange,
    removeUploadedImage,
    readFileAsDataUrl,
    saveProjectChanges,
  }
}
