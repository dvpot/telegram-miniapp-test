    // Telegram
    const tg = window.Telegram?.WebApp;
    if (tg) tg.ready();

    // DOM
    const usernameEl = document.getElementById('username');
    const imageArea = document.getElementById('imageArea');
    const wordField = document.getElementById('wordField');
    const wordText = document.getElementById('wordText');
    const transText = document.getElementById('transText');
    const translationText = document.getElementById('translationText');
    const speakENBtn = document.getElementById('speakEN_small');
    const speakRUBtn = document.getElementById('speakRU_small');
    const nextBtn = document.getElementById('nextBtn');

    // Telegram имя
    const user = tg?.initDataUnsafe?.user;
    if (user) {
      usernameEl.textContent = `Привет, ${user.first_name || user.username}!`;
    }

    // --- Состояние ---
    let words = [];
    let current = null;
    let revealed = false;

    // --- Цвета ---
    function colorForWord(word) {
      if (!word) return null;
      const map = {
        red:"red", blue:"blue", green:"green", yellow:"yellow",
        pink:"pink", purple:"purple", black:"black", white:"white",
        brown:"brown", grey:"grey", gray:"gray", orange:"orange",
        gold:"gold", silver:"silver", "sky blue":"skyblue", skyblue:"skyblue"
      };
      return map[word.toLowerCase()] || null;
    }

    // --- Картинка ---
    function showTextInstead(text) {
      imageArea.innerHTML = "";
      imageArea.style.background = "#f3f4f6";
      const d = document.createElement("div");
      d.className = "image-placeholder";
      d.textContent = text?.toUpperCase() || "—";
      imageArea.appendChild(d);
    }

    function setImageContent(src, translation, word) {
      imageArea.innerHTML = "";
      imageArea.style.background = "";

      const color = colorForWord(word);
      if (color) {
        imageArea.style.background = color;
        const d = document.createElement("div");
        d.className = "image-placeholder";
        d.textContent = "";
        imageArea.appendChild(d);
        return;
      }

      if (src) {
        const img = document.createElement("img");
        img.src = src;
        img.alt = word || translation || "image";
        img.onerror = () => showTextInstead(translation);
        imageArea.appendChild(img);
        return;
      }

      showTextInstead(translation);
    }


    // --- Загрузка words.json (надёжная) ---
    function loadWords() {
      return fetch("words.json?nocache=" + Date.now())
        .then(r => r.json())
        .then(j => { words = j; })
        .catch(e => {
          console.error("Ошибка загрузки words.json:", e);
          words = [];
        });
    }


    // --- Новое слово ---
    function loadRandomWord() {
      if (!words.length) {
        wordText.textContent = "---";
        transText.textContent = "---";
        translationText.textContent = "---";
        setImageContent(null, null, null);
        return;
      }

      current = words[Math.floor(Math.random() * words.length)];
      revealed = false;

      wordText.textContent = current.word || "---";
      transText.textContent = current.transcription ? `[${current.transcription}]` : "---";
      translationText.textContent = current.translation || "---";

      setImageContent(
        current.image || null,
        current.translation || "",
        current.word || ""
      );

      wordText.classList.remove("visible");
      transText.classList.remove("visible");
      speakENBtn.classList.remove("visible");
    }

    // --- Раскрытие слова ---
    function reveal() {
      if (!revealed) {
        revealed = true;
        wordText.classList.add("visible");
        transText.classList.add("visible");
        speakENBtn.classList.add("visible");
      }
    }

    // --- Обработчики ---
    wordField.addEventListener("click", reveal);
    nextBtn.addEventListener("click", loadRandomWord);

    // Кнопки звука отключены полностью
    speakENBtn.style.display = "none";
    speakRUBtn.style.display = "none";

    // --- ИНИЦИАЛИЗАЦИЯ ---
    loadWords().then(loadRandomWord);
