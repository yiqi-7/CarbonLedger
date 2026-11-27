import { reactive, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { useProjectInfoEditor } from './useProjectInfoEditor.js'

class TestFile {
  constructor(type, size, name) {
    this.type = type
    this.size = size
    this.name = name
  }
}

class TestFileReader {
  result = null
  error = null
  listeners = {}

  addEventListener(type, listener) {
    this.listeners[type] = listener
  }

  readAsDataURL() {
    this.result = 'data:image/png;base64,encoded'
    this.listeners.load()
  }
}

function createEditor(overrides = {}) {
  const draft = reactive({
    projectName: '项目',
    modelImage: null,
    modelImageName: '',
    accountingStages: ['阶段'],
  })
  const uploadedImageUrl = ref('')
  const urlRef = {
    createObjectURL: vi.fn(file => `blob:${file.name}`),
    revokeObjectURL: vi.fn(),
  }
  const notify = vi.fn()
  const editor = useProjectInfoEditor({
    draft,
    uploadedImageUrl,
    ProjectInfo: draft,
    projectApi: { patchProject: vi.fn() },
    persistence: { enqueue: vi.fn(async (action, _refresh, onSuccess) => {
      const result = await action()
      onSuccess?.(result)
      return result
    }) },
    canSave: () => true,
    notify,
    saveProjectInfo: vi.fn(),
    setSavedProjectDraft: vi.fn(),
    FileCtor: TestFile,
    URLRef: urlRef,
    FileReaderCtor: TestFileReader,
    ...overrides,
  })
  return { editor, draft, uploadedImageUrl, urlRef, notify }
}

describe('useProjectInfoEditor', () => {
  it('rejects unsupported and oversized images with the existing messages', () => {
    const { editor, draft, uploadedImageUrl, notify } = createEditor()
    const unsupportedTarget = { files: [new TestFile('image/svg+xml', 1, 'model.svg')], value: 'model.svg' }
    editor.handleFileChange({ target: unsupportedTarget })
    expect(unsupportedTarget.value).toBe('')
    expect(notify).toHaveBeenLastCalledWith('请选择 PNG、JPG 或 WebP 图片')
    expect(draft.modelImage).toBeNull()

    const oversizedTarget = { files: [new TestFile('image/png', 10 * 1024 * 1024 + 1, 'large.png')], value: 'large.png' }
    editor.handleFileChange({ target: oversizedTarget })
    expect(oversizedTarget.value).toBe('')
    expect(notify).toHaveBeenLastCalledWith('图片不能超过 10MB')
    expect(uploadedImageUrl.value).toBe('')
  })

  it('revokes replaced and removed previews while retaining same-file reselection', () => {
    const { editor, draft, uploadedImageUrl, urlRef } = createEditor()
    const first = new TestFile('image/png', 1, 'first.png')
    const second = new TestFile('image/webp', 1, 'second.webp')
    const target = { files: [first], value: 'first.png' }
    editor.handleFileChange({ target })
    expect(uploadedImageUrl.value).toBe('blob:first.png')
    editor.handleFileChange({ target: { files: [second], value: 'second.webp' } })
    expect(urlRef.revokeObjectURL).toHaveBeenCalledWith('blob:first.png')
    editor.removeUploadedImage()
    expect(urlRef.revokeObjectURL).toHaveBeenCalledWith('blob:second.webp')
    expect(draft.modelImage).toBeNull()
    expect(draft.modelImageName).toBe('')
    expect(uploadedImageUrl.value).toBe('')
  })

  it('converts the draft image before patching, then updates ProjectInfo', async () => {
    const calls = []
    const projectApi = {
      patchProject: vi.fn(async payload => {
        calls.push(['patch', payload])
        return { data: { ...payload, projectName: '已保存' } }
      }),
    }
    const saveProjectInfo = vi.fn(data => calls.push(['saveProjectInfo', data]))
    const { editor, draft } = createEditor({ projectApi, saveProjectInfo })
    draft.modelImage = new TestFile('image/png', 1, 'model.png')
    const result = await editor.saveProjectChanges({ target: { reportValidity: () => true } })

    expect(result.projectName).toBe('已保存')
    expect(projectApi.patchProject).toHaveBeenCalledWith(expect.objectContaining({ modelImage: 'data:image/png;base64,encoded' }))
    expect(calls.map(([name]) => name)).toEqual(['patch', 'saveProjectInfo'])
  })
})
