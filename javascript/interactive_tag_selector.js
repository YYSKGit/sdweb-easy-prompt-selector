class ITSElementBuilder {
  // Templates
  static baseButton(text, { size = 'sm', color = 'primary' }) {
    const button = gradioApp().getElementById('txt2img_generate').cloneNode()
    button.id = ''
    button.classList.remove('gr-button-lg', 'gr-button-primary', 'lg', 'primary')
    button.classList.add(
      // gradio 3.16
      `gr-button-${size}`,
      `gr-button-${color}`,
      // gradio 3.22
      size,
      color
    )
    button.textContent = text

    return button
  }

  static tagFields() {
    const fields = document.createElement('div')
    fields.style.display = 'flex'
    fields.style.flexDirection = 'row'
    fields.style.flexWrap = 'wrap'
    fields.style.minWidth = 'min(320px, 100%)'
    fields.style.maxWidth = '100%'
    fields.style.flex = '1 calc(50% - 20px)'
    fields.style.borderWidth = '1px'
    fields.style.borderColor = 'var(--block-border-color,#374151)'
    fields.style.borderRadius = 'var(--block-radius,8px)'
    fields.style.padding = '8px'
    fields.style.height = 'fit-content'

    return fields
  }

  // Elements
  static openButton({ onClick }) {
    const button = ITSElementBuilder.baseButton('🔯 提示词选择器', { size: 'sm', color: 'secondary' })
    button.style = 'margin-top: 0.5rem;'
    button.addEventListener('click', onClick)

    return button
  }

  static areaContainer(id = undefined) {
    const container = gradioApp().getElementById('txt2img_results').cloneNode()
    container.id = id
    container.style.gap = 0
    container.style.display = 'none'

    return container
  }

  static tagButton({ title, onClick, onRightClick, color = 'primary' }) {
    const button = ITSElementBuilder.baseButton(title, { color })
    button.style.height = '2rem'
    button.style.flexGrow = '0'
    button.style.margin = '2px'

    button.addEventListener('click', onClick)
    button.addEventListener('contextmenu', onRightClick)

    return button
  }

  static dropDown(id, options, { onChange }) {
    const select = document.createElement('select')
    select.id = id

    // gradio 3.16
    select.classList.add('gr-box', 'gr-input')

    // gradio 3.22
    select.style.color = 'var(--body-text-color)'
    select.style.backgroundColor = 'var(--input-background-fill)'
    select.style.borderColor = 'var(--block-border-color)'
    select.style.borderRadius = 'var(--block-radius)'
    select.style.margin = '2px'
    select.addEventListener('change', (event) => { onChange(event.target.value) })

    options.forEach((key) => {
      const option = document.createElement('option')
      option.value = key
      option.textContent = key
      select.appendChild(option)
    })
    select.value = options[0]

    return select
  }

  static checkbox(text, { onChange }) {
    const label = document.createElement('label')
    label.style.display = 'flex'
    label.style.alignItems = 'center'

    const checkbox = gradioApp().querySelector('input[type=checkbox]').cloneNode()
    checkbox.addEventListener('change', (event) => {
       onChange(event.target.checked)
    })

    const span = document.createElement('span')
    span.style.marginLeft = 'var(--size-2, 8px)'
    span.textContent = text

    label.appendChild(checkbox)
    label.appendChild(span)

    return label
  }
}

class InteractiveTagSelector {

  PATH_FILE = 'tmp/interactiveTagSelector.txt'
  AREA_ID = 'interactive-tag-selector'
  SELECT_ID = 'interactive-tag-selector-select'
  CONTENT_ID = 'interactive-tag-selector-content'
  
  MY_WHITE_CHARS = [' ', '\r', '\n']
  MY_CLIPR_CHARS = [',', ':', '|', '(', '[', '{', '<']
  MY_CLIPL_CHARS = [',', ':', '|', ')', ']', '}', '>']

  constructor(yaml, gradioApp) {
    this.yaml = yaml
    this.gradioApp = gradioApp
    this.visible = false
    this.nsfwMode = false
    this.promptFocus = null
    this.tags = undefined
  }

  async init() {
    this.tags = await this.parseFiles()

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

  async readFile(filepath) {
    const response = await fetch(`file=${filepath}?${new Date().getTime()}`);

    return await response.text();
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

  // Render
  render() {
    const row = document.createElement('div')
    row.style.display = 'flex'
    row.style.alignItems = 'center'
    row.style.gap = '10px'

    const dropDown = this.renderDropdown()
    dropDown.style.flex = '1'
    dropDown.style.minWidth = '1'
    row.appendChild(dropDown)

    const content = this.renderContent()
    const checkbox = ITSElementBuilder.checkbox('🌸 NSFW', {
      onChange: (checked) => {
          this.nsfwMode = checked
          this.renderContent(content)
          this.selectTags(dropDown.value, content)
          dropDown.focus({preventScroll: true})
      }
    })
    this.selectTags(dropDown.value, content)

    const settings = document.createElement('div')
    settings.style.flex = '1'
    settings.appendChild(checkbox)
    row.appendChild(settings)

    const container = ITSElementBuilder.areaContainer(this.AREA_ID)
    container.appendChild(row)
    container.appendChild(content)
    return container
  }

  renderDropdown() {
    const dropDown = ITSElementBuilder.dropDown(
      this.SELECT_ID,
      Object.keys(this.tags), {
        onChange: (selected) => {
          const content = gradioApp().getElementById(this.CONTENT_ID)
          this.selectTags(selected, content)
        }
      }
    )

    return dropDown
  }

  renderContent(content = null) {
    if (content === null) {
      content = document.createElement('div')
      content.id = this.CONTENT_ID
    } else {
      content.innerHTML = ''
    }

    Object.keys(this.tags).forEach((key) => {
      const values = this.tags[key]

      const fields = ITSElementBuilder.tagFields()
      fields.id = `interactive-tag-selector-container-${key}`
      fields.style.display = 'none'
      fields.style.flexDirection = 'row'
      fields.style.marginTop = '10px'

      this.renderTagButtons(values, key, true).forEach((group) => {
        if (group !== null) {
          fields.appendChild(group)
        }
      })

      content.appendChild(fields)
    })

    return content
  }

  renderTagButtons(tags, prefix = '', isTop) {
    if (Array.isArray(tags)) {
      return tags.map((tag) => this.renderTagButton(tag, tag, 'secondary'))
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
          return this.renderTagButton(key, values, 'secondary')
        }

        const fields = ITSElementBuilder.tagFields()
        if (isTop) {
          fields.style.flex = '1 calc(100% - 10px)'
        }
        fields.style.flexDirection = 'column'

        randomKey = randomKey.replace(/-/g,'/')
        fields.append(this.renderTagButton(key, `__${randomKey}__`))

        const buttons = ITSElementBuilder.tagFields()
        buttons.id = 'buttons'
        fields.append(buttons)

        this.renderTagButtons(values, randomKey, false).forEach((button) => {
          if (button !== null) {
            buttons.appendChild(button)
          }
        })

        return fields
      })
    }
  }

  renderTagButton(title, value, color = 'primary') {
    return ITSElementBuilder.tagButton({
      title,
      onClick: () => { this.addTag(value) },
      onRightClick: (e) => { e.preventDefault(); this.removeTag(value) },
      color
    })
  }

  selectTags(selected, content) {
    Array.from(content.childNodes).forEach((node) => {
      const visible = node.id === `interactive-tag-selector-container-${selected}`
      this.changeVisibility(node, visible)
    })
  }

  // Util
  changeVisibility(node, visible) {
    node.style.display = visible ? 'flex' : 'none'
  }

  addTag(tag) {
    const textArea = this.promptFocus
    const textStart = textArea.selectionStart
    const textEnd = textArea.selectionEnd
    const textValue = textArea.value.slice(0, textStart) + textArea.value.slice(textEnd)
    const textTags = textValue.split(",");

    //获取光标所在标签索引
    const textTagsIndex = textTags.reduce((accumulator, currentValue) => {
      if (! accumulator.stop) {
        const currentSum = accumulator.sum + accumulator.index + currentValue.length
        if (currentSum < textStart) {
          accumulator.sum = currentSum
          accumulator.index ++
        } else {
          accumulator.stop = true
        }
      }
      return accumulator
    }, {sum:0, index:0, stop:false})

    if (textTagsIndex.index === textTags.length) {
      textTags.push("")
    }
    const textTag = textTags[textTagsIndex.index + 1]

    textTags[textTagsIndex.index + 1] = tag
    textArea.value = textTags.join(",")
    textArea.selectionStart = textStart + tag.length
    textArea.selectionEnd = textArea.selectionStart
    updateInput(textArea)
    
    textArea.focus({preventScroll: true})
    gradioApp().getElementById(this.SELECT_ID).focus({preventScroll: true})
  }

  removeTag(tag) {
    const id = this.toNegative ? 'txt2img_neg_prompt' : 'txt2img_prompt'
    const textarea = gradioApp().getElementById(id).querySelector('textarea')

    if (textarea.value.trimStart().startsWith(tag)) {
      const matched = textarea.value.match(new RegExp(`${tag.replace(/[-\/\\^$*+?.()|\[\]{}]/g, '\\$&') },*`))
      textarea.value = textarea.value.replace(matched[0], '').trimStart()
    } else {
      textarea.value = textarea.value.replace(`, ${tag}`, '')
    }

    updateInput(textarea)
  }
}

onUiLoaded(async () => {
  yaml = window.jsyaml
  const interactiveTagSelector = new InteractiveTagSelector(yaml, gradioApp())
  await interactiveTagSelector.init()

  const button = ITSElementBuilder.openButton({
    onClick: () => {
      const tagArea = gradioApp().querySelector(`#${interactiveTagSelector.AREA_ID}`)
      interactiveTagSelector.changeVisibility(tagArea, interactiveTagSelector.visible = !interactiveTagSelector.visible)
    }
  })

  const txt2imgActionColumn = gradioApp().getElementById('txt2img_actions_column')
  txt2imgActionColumn.appendChild(button)

  gradioApp()
    .getElementById('txt2img_toprow')
    .after(interactiveTagSelector.render())
})