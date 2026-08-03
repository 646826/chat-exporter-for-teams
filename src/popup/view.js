function element(doc, tagName, options = {}) {
  const node = doc.createElement(tagName);
  if (options.className) node.className = options.className;
  if (options.text != null) node.textContent = String(options.text);
  for (const [name, value] of Object.entries(options.attributes || {})) node.setAttribute(name, String(value));
  if (options.type) node.type = options.type;
  return node;
}

export function createPopupView(doc, strings, options = {}) {
  const root = options.root || doc.getElementById('app') || doc.body;
  root.textContent = '';
  const shell = element(doc, 'section', { className: 'shell' });
  const brand = element(doc, 'header', { className: 'brand' });
  const icon = element(doc, 'img', {
    attributes: { src: options.iconUrl || '../assets/icon48.png', alt: '' },
  });
  const brandCopy = element(doc, 'div', { className: 'brand-copy' });
  brandCopy.append(
    element(doc, 'h1', { className: 'brand-name', text: strings.popupTitle }),
    element(doc, 'p', { className: 'brand-subtitle', text: strings.popupSubtitle }),
  );
  brand.append(icon, brandCopy);

  const card = element(doc, 'section', { className: 'card' });
  const statusRow = element(doc, 'div', { className: 'status-row' });
  const statusIcon = element(doc, 'span', { className: 'status-dot neutral', text: '•', attributes: { 'aria-hidden': 'true' } });
  const statusCopy = element(doc, 'div');
  const statusTitle = element(doc, 'p', { className: 'status-title' });
  const statusDetail = element(doc, 'p', { className: 'status-detail' });
  statusCopy.append(statusTitle, statusDetail);
  statusRow.append(statusIcon, statusCopy);

  const disclosure = element(doc, 'p', { className: 'disclosure hidden', text: strings.disclosureText });
  const optionLabel = element(doc, 'label', { className: 'option hidden' });
  const optionText = element(doc, 'span', { text: strings.includeAttachments });
  const includeAttachments = element(doc, 'input', { type: 'checkbox', attributes: { 'aria-label': strings.includeAttachments } });
  optionLabel.append(optionText, includeAttachments);

  const primaryButton = element(doc, 'button', { className: 'primary hidden', type: 'button' });
  const privacy = element(doc, 'div', { className: 'privacy' });
  privacy.append(element(doc, 'span', { className: 'privacy-mark', attributes: { 'aria-hidden': 'true' } }), element(doc, 'span', { text: strings.localOnly }));
  card.append(statusRow, disclosure, optionLabel, primaryButton);
  shell.append(brand, card, privacy);
  root.appendChild(shell);

  function setStatus(kind, title, detail) {
    statusIcon.className = `status-dot ${kind === 'ok' ? '' : kind}`.trim();
    statusIcon.textContent = kind === 'ok' ? '✓' : kind === 'error' ? '!' : '•';
    statusTitle.textContent = title || '';
    statusDetail.textContent = detail || '';
  }

  function hideControls() {
    disclosure.classList.add('hidden');
    optionLabel.classList.add('hidden');
    primaryButton.classList.add('hidden');
    primaryButton.disabled = false;
  }

  return {
    elements: { root, includeAttachments, primaryButton },
    showLoading() {
      hideControls();
      statusIcon.textContent = '';
      statusIcon.className = 'spinner';
      statusTitle.textContent = strings.checkingTitle || '';
      statusDetail.textContent = strings.checkingDetail || '';
    },
    showDisclosure() {
      hideControls();
      setStatus('neutral', strings.disclosureTitle, strings.disclosureDetail);
      disclosure.classList.remove('hidden');
      primaryButton.textContent = strings.continueButton;
      primaryButton.classList.remove('hidden');
    },
    showSupported(chatTitle = '') {
      hideControls();
      setStatus('ok', strings.chatDetected, chatTitle || strings.currentConversation);
      optionLabel.classList.remove('hidden');
      primaryButton.textContent = strings.exportButton;
      primaryButton.classList.remove('hidden');
    },
    showUnsupported() {
      hideControls();
      setStatus('neutral', strings.openChatTitle, strings.openChatDetail);
      primaryButton.textContent = strings.openTeamsButton;
      primaryButton.classList.remove('hidden');
      primaryButton.className = 'secondary';
    },
    showStarting() {
      hideControls();
      setStatus('ok', strings.exportStartingTitle, strings.exportStartingDetail);
    },
    showError(message) {
      hideControls();
      setStatus('error', strings.errorTitle, message || strings.errorGeneric);
    },
    resetPrimaryClass() {
      primaryButton.className = 'primary';
    },
  };
}
