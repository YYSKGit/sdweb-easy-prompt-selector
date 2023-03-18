class InteractiveTagSelector {

  PATH_FILE = 'tmp/interactiveTagSelector.txt'
  AREA_ID = 'interactive-tag-selector'
  SELECT_ID = 'interactive-tag-selector-select'
  CONTENT_ID = 'interactive-tag-selector-content'
  NSFW_MODE_ID = 'interactive-tag-selector-nsfw-mode'

  MY_WHITE_CHARS = [' ', '\r', '\n']
  MY_CLIPR_CHARS = [',', ':', '|', '(', '[', '{', '<']
  MY_CLIPL_CHARS = [',', ':', '|', ')', ']', '}', '>']

  constructor(yaml, gradioApp) {
    this.yaml = yaml
    this.gradioApp = gradioApp
    this.visible = false
    this.nsfwMode = false
    this.promptFocus = null
  }

  async readFile(filepath) {
    const response = await fetch(`file=${filepath}?${new Date().getTime()}`);

    return await response.text();
  }

  createTagButtons(tags, prefix = '',isTop) {
    if (Array.isArray(tags)) {
      return tags.map((tag) => this.createTagButton(tag, tag, 'secondary'))
    } else {
      return Object.keys(tags).map((key) => {
        const values = tags[key]
        let randomKey = `${prefix}/${key}`

        if (typeof values === 'string') {
          if (key.endsWith('-NSFW')) {
            key = key.substring(0, key.length - 5)
          } else if (this.nsfwMode) {
            return null
          }
          return this.createTagButton(key, values, 'secondary')
        }

        const mSize = isTop ? '100%' :'50%'
        const group = document.createElement('div')
        group.classList.add('gr-block', 'gr-box', 'relative', 'w-full', 'border-solid', 'border', 'border-gray-200', 'flex', 'flex-col', 'col', 'flex-wrap', 'gap-2', 'p-2')
        group.style = `min-width: min(320px, 100%); flex-basis: ${mSize}; flex-grow: 1;`
        randomKey = randomKey.replace(/-/g,'/')
        group.append(this.createTagButton(key, `__${randomKey}__`))
        group.insertAdjacentHTML('beforeend', '<div class="flex flex-col buttons"></div>')

        const buttons = group.querySelector('.buttons')
        buttons.classList.add('gr-block', 'gr-box', 'relative', 'w-full', 'flex', 'flex-wrap')
        buttons.style = 'flex-direction: initial;'

        this.createTagButtons(values, randomKey, false).forEach((button) => {
          if (button !== null) {
            buttons.appendChild(button)
          }
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
              <option>[无]</option>
            </select>
            <div style="min-width: min(200px, 100%); flex: 1">
              <label class="flex items-center text-gray-700 text-sm space-x-2 rounded-lg cursor-pointer dark:bg-transparent">
                <input type="checkbox" id="${this.NSFW_MODE_ID}" class="gr-check-radio gr-checkbox">
                <span class="ml-2">🌸 NSFW</span>
              </label>
            </div>
          </div>
          <div id="${this.CONTENT_ID}" class="flex flex-row flex-wrap"></div>
        </div>
      </div>
    `
    const select = tagArea.querySelector(`#${this.SELECT_ID}`)
    const content = tagArea.querySelector(`#${this.CONTENT_ID}`)
    const nsfwModeCheckbox = tagArea.querySelector(`#${this.NSFW_MODE_ID}`)

    select.addEventListener('change', (event) => {
      this.selectTags(event.target.value, content)
    })
    nsfwModeCheckbox.addEventListener('change', (event) => {
      this.nsfwMode = event.target.checked
      this.updateTags(select, content, tags)
    })
    this.updateTags(select, content, tags)

    gradioApp().getElementById('txt2img_toprow').after(tagArea)

    const prompt = gradioApp().getElementById('txt2img_prompt').querySelector('textarea')
    const promptNeg = gradioApp().getElementById('txt2img_neg_prompt').querySelector('textarea')
    prompt.addEventListener('focus', () => {
        this.promptFocus = prompt
    })
    promptNeg.addEventListener('focus', () => {
        this.promptFocus = promptNeg
    })
    this.promptFocus = prompt
  }

  updateTags(select, content, tags) {
    const selectValue = select.value
    select.innerHTML = ''
    content.innerHTML = ''

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

      this.createTagButtons(values, key, true).forEach((group) => {
        if (group !== null) {
          container.appendChild(group)
        }
      })

      content.appendChild(container)
    })

    if (selectValue !== '[无]') {
      select.value = selectValue
    }
    this.selectTags(select.value, content)
    select.focus({preventScroll: true})
  }

  selectTags(selected, content) {
    Array.from(content.childNodes).forEach((node) => {
      const visible = node.id === `interactive-tag-selector-container-${selected}`
      this.changeVisibility(node, visible)
    })
  }

  changeVisibility(node, visible) {
    const style = visible ? 'display: flex;' : 'display: none;'
    node.style = style
  }

  addTag(tag) {
    const textArea = this.promptFocus
    let mTextLeft = textArea.value.slice(0, textArea.selectionStart)
    let mTextRight = textArea.value.slice(textArea.selectionEnd)
    
    for (let i = mTextLeft.length; i > 0; i --) {
        let mTextClip = mTextLeft.slice(i - 1, i)
        if (! this.MY_WHITE_CHARS.includes(mTextClip)) {
            if (! this.MY_CLIPR_CHARS.includes(mTextClip)) {
                tag = ', ' + tag
            }
            break
        }
    }

    for (let i = 0; i < mTextRight.length; i ++) {
        let mTextClip = mTextRight.slice(i, i + 1)
        if (! this.MY_WHITE_CHARS.includes(mTextClip)) {
            if (! this.MY_CLIPL_CHARS.includes(mTextClip)) {
                tag = tag + ', '
            }
            break
        }
    }
    if (mTextRight.length === 0) {
        tag = tag + ', '
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
  button.textContent = '🔯 提示词选择器'
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