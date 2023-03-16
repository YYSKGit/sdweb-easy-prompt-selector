class InteractiveTagSelector {
  PATH_FILE = 'tmp/interactiveTagSelector.txt'
  AREA_ID = 'interactive-tag-selector'
  SELECT_ID = 'interactive-tag-selector-select'
  CONTENT_ID = 'interactive-tag-selector-content'
  TO_NEGATIVE_PROMPT_ID = 'interactive-tag-selector-to-negative-prompt'
  MY_WHITE_CHARS = [' ', '\r', '\n']
  MY_CLIPR_CHARS = [',', ':', "|", '(', '[', '{']
  MY_CLIPL_CHARS = [',', ':', "|", ')', ']', '}']

  constructor(yaml, gradioApp) {
    this.yaml = yaml
    this.gradioApp = gradioApp
    this.visible = false
    this.toNegative = false
  }

  async readFile(filepath) {
    const response = await fetch(`file=${filepath}?${new Date().getTime()}`);

    return await response.text();
  }

  createTagButtons(tags, prefix = '') {
    if (Array.isArray(tags)) {
      return tags.map((tag) => this.createTagButton(tag, tag, 'secondary'))
    } else {
      return Object.keys(tags).map((key) => {
        const values = tags[key]
        const randomKey = `${prefix}/${key}`

        if (typeof values === 'string') { return this.createTagButton(key, values, 'secondary') }

        const group = document.createElement('div')
        group.classList.add('gr-block', 'gr-box', 'relative', 'w-full', 'border-solid', 'border', 'border-gray-200', 'flex', 'flex-col', 'col', 'flex-wrap', 'gap-2', 'p-2')
        group.style = `min-width: min(320px, 100%); flex-basis: 50%; flex-grow: 1;`
        group.append(this.createTagButton(key, `__${randomKey}__`))
        group.insertAdjacentHTML('beforeend', '<div class="flex flex-col buttons"></div>')

        const buttons = group.querySelector('.buttons')
        buttons.classList.add('gr-block', 'gr-box', 'relative', 'w-full', 'flex', 'flex-wrap')
        buttons.style = 'flex-direction: initial;'

        this.createTagButtons(values, randomKey).forEach((button) => {
          buttons.appendChild(button)
        })

        return group
      })
    }
  }

  createTagButton(title, value, color = 'primary') {
    const button = document.createElement('button')
    button.classList.add('gr-button', 'gr-button-sm', `gr-button-${color}`)
    button.style = 'height: 2rem; flex-grow: 0; margin: 2px;'
    button.textContent = title
    button.addEventListener('click', () => { this.addTag(value) })

    return button
  }

  createTagArea(tags = {}) {
    const tagArea = document.createElement('div')
    tagArea.id = this.AREA_ID
    tagArea.classList.add('flex', 'flex-col', 'relative', 'col', 'gr-panel')
    tagArea.style = 'display: none;'

    tagArea.innerHTML = `
      <div class="flex flex-col relative col">
        <div class="gr-block gr-box relative w-full border-solid border border-gray-200">
          <div class="flex flex-row flex-wrap w-full gap-2" style="align-items: center;">
            <select id="${this.SELECT_ID}" class="gr-box gr-input w-full" style="min-width: min(400px, 100%); flex: 3;">
              <option>无</option>
            </select>
            <div style="min-width: min(200px, 100%); flex: 1">
              <label class="flex items-center text-gray-700 text-sm space-x-2 rounded-lg cursor-pointer dark:bg-transparent">
                <input type="checkbox" id="${this.TO_NEGATIVE_PROMPT_ID}" class="gr-check-radio gr-checkbox">
                <span class="ml-2">写入到反向提示词</span>
              </label>
            </div>
          </div>
          <div id="${this.CONTENT_ID}" class="flex flex-row flex-wrap"></div>
        </div>
      </div>
    `
    const select = tagArea.querySelector(`#${this.SELECT_ID}`)
    const content = tagArea.querySelector(`#${this.CONTENT_ID}`)
    const toNegativePromptCheckbox = tagArea.querySelector(`#${this.TO_NEGATIVE_PROMPT_ID}`)

    Object.keys(tags).forEach((key) => {
      const values = tags[key]

      const option = document.createElement('option')
      option.value = key
      option.textContent = key
      select.appendChild(option)

      const container = document.createElement('div')
      container.id = `interactive-tag-selector-container-${key}`
      container.classList.add('flex', 'flex-row', 'flex-wrap')
      container.style = 'display: none;'

      this.createTagButtons(values, key).forEach((group) => {
        container.appendChild(group)
      })

      content.appendChild(container)
    })

    select.addEventListener('change', (event) => {
      const selected = event.target.value
      Array.from(content.childNodes).forEach((node) => {
        const visible = node.id === `interactive-tag-selector-container-${selected}`
        this.changeVisibility(node, visible)
      })
    })

    toNegativePromptCheckbox.addEventListener('change', (event) => {
      this.toNegative = event.target.checked
    })


    gradioApp().getElementById('txt2img_toprow').after(tagArea)
  }

  changeVisibility(node, visible) {
    const style = visible ? 'display: flex;' : 'display: none;'
    node.style = style
  }

  addTag(tag) {
    const id = this.toNegative ? 'txt2img_neg_prompt' : 'txt2img_prompt'
    const textArea = gradioApp().getElementById(id).querySelector('textarea')
    let mTextLeft = textArea.value.slice(0, textArea.selectionStart)
    let mTextRight = textArea.value.slice(textArea.selectionEnd)
    
    for (let i = mTextLeft.length; i > 0; i --) {
        let mTextClip = mTextLeft.slice(i - 1, i)
        if (! this.MY_WHITE_CHARS.includes(mTextClip)) {
            if (! this.MY_CLIPR_CHARS.includes(mTextClip)) {
                tag = ", " + tag
            }
            break
        }
    }

    for (let i = 0; i < mTextRight.length; i ++) {
        let mTextClip = mTextRight.slice(i, i + 1)
        if (! this.MY_WHITE_CHARS.includes(mTextClip)) {
            if (! this.MY_CLIPL_CHARS.includes(mTextClip)) {
                tag = tag + ", "
            }
            break
        }
    }
    if (mTextRight.length === 0) {
        tag = tag + ", "
    }

    textArea.value = mTextLeft + tag + mTextRight
    textArea.selectionStart = mTextLeft.length + tag.length
    textArea.selectionEnd = textArea.selectionStart
    updateInput(textArea)
    
    textArea.focus({preventScroll: true})
    gradioApp().getElementById(this.SELECT_ID).focus({preventScroll: true})
  }

  async parseFiles() {
    const text = await this.readFile(this.PATH_FILE);
    if (text === '') { return {} }

    const paths = text.split(/\r\n|\n/)

    const tags = {}
    for (const path of paths) {
      const filename = path.split('/').pop().split('.').shift()
      const data = await this.readFile(path)
      yaml.loadAll(data, function (doc) {
        tags[filename] = doc
      })
    }

    return tags
  }
}

onUiLoaded(async () => {
  yaml = window.jsyaml
  const interactiveTagSelector = new InteractiveTagSelector(yaml, gradioApp())
  const tags = await interactiveTagSelector.parseFiles()

  const button = document.createElement('button')
  button.textContent = '🔯提示词选择器'
  button.classList.add('gr-button', 'gr-button-sm', 'gr-button-secondary')
  button.style = 'margin-top: 0.5rem;'

  button.addEventListener('click', () => {
    const tagArea = gradioApp().querySelector(`#${interactiveTagSelector.AREA_ID}`)
    interactiveTagSelector.changeVisibility(tagArea, interactiveTagSelector.visible = !interactiveTagSelector.visible)
  })

  const txt2imgActionColumn = gradioApp().getElementById('txt2img_actions_column')
  txt2imgActionColumn.appendChild(button)

  interactiveTagSelector.createTagArea(tags)
})