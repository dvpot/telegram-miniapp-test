/* app.js
   Логика приложения: загрузка списка слов, показ случайного слова,
   обработка изображения / цвета / placeholder, TTS (озвучка),
   и обработчики кнопок.
*/

/* Инициализация Telegram WebApp (если доступно) */
const tg = window.Telegram?.WebApp;
if (tg) tg.ready();

/* ===================== ЭЛЕМЕНТЫ DOM ===================== */
/* Основные DOM-элементы, с которыми работает логика */
const usernameEl = document.getElementById('username');
const imageArea = document.getElementById('imageArea');
const imagePlaceholder = document.getElementById('imagePlaceholder');
const wordField = document.getElementById('wordField');
const wordText = document.getElementById('wordText');
const transText = document.getElementById('transText');
const translationText = document.getElementById('translationText');
const speakENBtn = document.getElementById('speakEN_small');
const speakRUBtn = document.getElementById('speakRU_small');
const nextBtn = document.getElementById('nextBtn');

/* Если есть Telegram user — отображаем имя */
const user = tg?.initDataUnsafe?.user;
if (user) usernameEl.textContent = `Привет, ${user.first_name || user.username}!`;

/* ===================== Состояние приложения ===================== */
let words = [];       // массив слов из words.json
let current = null;   // текущий выбранный объект (слово)
let revealed = false; // флаг: раскрыто ли английское слово + транскрипция

/* ===================== УТИЛИТЫ ===================== */

/**
 * Проверяет, является ли слово названием цвета.
 * Поддерживаем базовый набор цветовых ключевых слов (англ).
 * Возвращает цвет CSS (если распознали) или null.
 */
function colorForWord(word){
  if (!word) return null;
  const key = word.toLowerCase().trim();

  // Простая карта популярных названий цветов -> CSS значения.
  // При необходимости дополняй.
  const map = {
    "red":"red","blue":"blue","green":"green","yellow":"yellow","pink":"pink",
    "purple":"purple","black":"black","white":"white","brown":"brown","grey":"grey",
    "gray":"gray","orange":"orange","golden":"gold","gold":"gold","silver":"silver",
    "dark":"#111","light":"#eee","sky blue":"skyblue","skyblue":"skyblue"
  };

  return map[key] || null;
}

/**
 * Возвращает корректный путь к локальному изображению.
 * Принимает значение из words.json (current.image).
 * Возвращает null если пусто.
 */
function imagePathOrNull(src){
  if (!src || !src.trim()) return null;
  return src.trim();
}

/* ===================== РАБОТА С ИЗОБРАЖЕНИЕМ / ЦВЕТОМ / ЗАГЛУШКОЙ ===================== */

/**
 * Установить изображение/цвет/placeholder в блок imageArea.
 * Правила:
 * 1) Если слово распознано как цвет (colorForWord) — закрасить фон в этот цвет и скрыть картинку.
 * 2) Иначе, если есть локальный путь к картинке — попытаться загрузить <img>.
 *    - Мы масштабируем изображение с помощью CSS (object-fit: cover) и ограничиваем max-height,
 *      чтобы картинка не "выталкивала" остальные поля.
 * 3) Если картинки нет или загрузка упала — показываем крупный текст из translation.
 */
function setImageContent(src, translation, word){
  // Очистим текущее содержимое
  imageArea.innerHTML = '';
  imageArea.style.background = ''; // сбросить возможный цвет

  // 1) Проверка: это цвет?
  const color = colorForWord(word || '');
  if (color){
    // Если слово — цвет, закрашиваем область в этот цвет
    imageArea.style.background = color;
    // В центре показываем название цвета или пустоту — по дизайну можно не показывать текст.
    const label = document.createElement('div');
    label.className = 'image-placeholder';
    label.textContent = ''; // можно оставить пустую область цветом
    imageArea.appendChild(label);
    return;
  }

  // 2) Если есть путь к картинке — пробуем загрузить
  const imgPath = imagePathOrNull(src);
  if (imgPath){
    const img = document.createElement('img');
    img.src = imgPath;
    img.alt = word || translation || 'image';
    // На случай больших фото — CSS в styles.css обеспечит object-fit и max-height
    // Обработчик ошибки: если картинка не загрузилась — покажем текст
    img.onerror = () => {
      imageArea.innerHTML = '';
      showTranslationAsImageText(translation);
    };
    // Если картинка загрузилась — добавляем в контейнер
    imageArea.appendChild(img);
    return;
  }

  // 3) Ничего нет — показываем перевод большими буквами
  showTranslationAsImageText(translation);
}

/**
 * Показывает вместо картинки крупный текст (translation).
 */
function showTranslationAsImageText(translation){
  const label = document.createElement('div');
  label.className = 'image-placeholder';
  // Показать перевод большими буквами. Если перевод пустой — показать слово '-'
  label.textContent = (translation && translation.trim()) ? translation.toUpperCase() : '—';
  // Установим нейтральный фон, чтобы текст был виден
  imageArea.style.background = '#f3f4f6';
  imageArea.appendChild(label);
}

/* ===================== ЗАГРУЗКА words.json ===================== */

/**
 * Загружает words.json (отключаем кэш для динамики).
 * При ошибке — words остаётся пустым.
 */
async function loadWords(){
  try{
    const r = await fetch('./words.json?v=2', { cache: 'no-store' });
    words = await r.json();
  }catch(e){
    console.error('Ошибка загрузки words.json', e);
    words = [];
  }
}

/* ===================== ОЗВУЧКА (TTS) ===================== */

/**
 * Попытка найти подходящий голос по префиксу языка.
 * Возвращает объект Voice или null.
 */
function getVoice(langPrefix){
  const voices = speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;
  // пытаемся найти голос с нужным префиксом (например "ru", "en")
  let v = voices.find(x => x.lang && x.lang.toLowerCase().startsWith(langPrefix.toLowerCase()));
  if (v) return v;
  // fallback: любой английский голос
  v = voices.find(x => x.lang && x.lang.toLowerCase().startsWith('en'));
  if (v) return v;
  return voices[0];
}

/**
 * Произнести текст в заданном языке (langTag: 'en-US' или 'ru-RU').
 * Отменяет предыдущую синтез-озвучку, если она была.
 */
function speak(text, langTag){
  if (!text) return;
  if (!('speechSynthesis' in window)){
    console.warn('Speech Synthesis не поддерживается в браузере');
    return;
  }
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = langTag;
  const v = getVoice(langTag.split('-')[0]);
  if (v) utter.voice = v;
  speechSynthesis.cancel();
  speechSynthesis.speak(utter);
}

/* ===================== ОСНОВНАЯ ЛОГИКА: показ случайного слова ===================== */

/**
 * Загрузить случайное слово из списка, обновить UI (слово, транскрипция, перевод, картинку).
 * Логика поведения — как раньше, только добавлены проверки для изображения/цвета/placeholder.
 */
function loadRandomWord(){
  if (!words || words.length === 0){
    translationText.textContent = '---';
    wordText.textContent = '---';
    transText.textContent = '---';
    setImageContent(null, null, null);
    return;
  }

  // Выбираем случайный индекс
  const idx = Math.floor(Math.random() * words.length);
  current = words[idx];
  revealed = false;

  // Заполняем поля (с защитой от undefined)
  wordText.textContent = current.word || '---';
  transText.textContent = current.transcription ? `[${current.transcription}]` : '---';
  translationText.textContent = current.translation || '---';

  // Устанавливаем картинку / цвет / placeholder
  setImageContent(current.image && current.image.length ? current.image : null,
                  current.translation || '',
                  current.word || '');

  // Скрываем английский текст и EN кнопку до раскрытия
  wordText.classList.remove('visible');
  transText.classList.remove('visible');
  speakENBtn.classList.remove('visible');
}

/* ===================== РАСШИРЕННЫЕ ОБРАБОТЧИКИ ===================== */

/* Раскрыть английское слово и транскрипцию (при клике по полю) */
function revealIfNeeded(){
  if (!revealed){
    wordText.classList.add('visible');
    transText.classList.add('visible');
    // Показать кнопку EN когда слово раскрыто
    speakENBtn.classList.add('visible');
    revealed = true;
  }
}

/* Предотвращаем всплытие клика при нажатии кнопок озвучки */
speakENBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (!current) return;
  if (!speakENBtn.classList.contains('visible')) return;
  speak(current.word, 'en-US');
});
speakRUBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (!current) return;
  speak(current.translation, 'ru-RU');
});

/* Клавиатурный доступ: Enter/Space на поле раскроют слово */
wordField.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    revealIfNeeded();
  }
});

/* Клик по полю раскрывает слово */
wordField.addEventListener('click', () => revealIfNeeded());

/* Кнопка "Следующее слово" */
nextBtn.addEventListener('click', () => {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  loadRandomWord();
});

/* ===================== ИНИЦИАЛИЗАЦИЯ ===================== */

/**
 * Инициализация: дождаться голосов (часть браузеров подгружает их асинхронно),
 * затем загрузить words.json и показать первое слово.
 */
(async function init(){
  // Ждём загрузки доступных голосов (пока максимально 700ms - если больше, продолжаем)
  await new Promise(resolve => {
    let done = false;
    function tryVoices(){
      const v = speechSynthesis.getVoices();
      if (v && v.length){
        if (!done){ done = true; resolve(); }
      } else {
        setTimeout(tryVoices, 80);
      }
    }
    tryVoices();
    setTimeout(() => { if (!done){ done = true; resolve(); } }, 700);
  });

  // Загружаем слова и показываем первое
  await loadWords();
  loadRandomWord();
})();
