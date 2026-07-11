/* ═══════════════════════════════════════════════
   MIDNIGHT MESSAGES — motion & emoção
   ═══════════════════════════════════════════════ */

(function () {
  "use strict";

  const hasGSAP = typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ─────────── ABERTURA: frase digitada ─────────── */

  const intro = document.getElementById("intro");
  const introType = document.getElementById("intro-type");
  const introSub = document.getElementById("intro-sub");
  const introBubble = document.getElementById("intro-bubble");
  const introSkip = document.getElementById("intro-skip");

  const introPhrase = "algumas conversas\nsó existem de madrugada";

  function typeIntro() {
    if (reduceMotion) {
      introType.innerHTML = introPhrase.replace("\n", "<br/>");
      introSub.classList.add("show");
      introBubble.classList.add("show");
      intro.classList.add("ready");
      return;
    }
    let i = 0;
    const speed = 62;
    (function tick() {
      if (i <= introPhrase.length) {
        introType.innerHTML = introPhrase.slice(0, i).replace("\n", "<br/>");
        i++;
        // pequenas hesitações, como quem pensa antes de digitar
        const pause = introPhrase[i - 1] === "\n" ? 550 : speed + Math.random() * 55;
        setTimeout(tick, pause);
      } else {
        setTimeout(() => introSub.classList.add("show"), 500);
        setTimeout(() => introBubble.classList.add("show"), 1600);
        setTimeout(() => intro.classList.add("ready"), 2200);
      }
    })();
  }
  setTimeout(typeIntro, 700);

  function leaveIntro() {
    if (intro.classList.contains("gone")) return;
    intro.classList.add("gone");
    document.body.style.overflow = "";
    setTimeout(() => intro.remove(), 1800);
  }
  document.body.style.overflow = "hidden";
  introSkip.addEventListener("click", leaveIntro);
  intro.addEventListener("wheel", leaveIntro, { passive: true });
  intro.addEventListener("touchmove", leaveIntro, { passive: true });
  intro.addEventListener("keydown", leaveIntro);
  // se a pessoa só esperar, a madrugada começa sozinha
  setTimeout(leaveIntro, 12000);

  /* ─────────── REVEALS AO SCROLL ─────────── */

  if (hasGSAP && !reduceMotion) {
    gsap.registerPlugin(ScrollTrigger);

    // mensagens surgem como mensagens de verdade: escala, leve mola
    document.querySelectorAll(".msg").forEach((el) => {
      const fromLeft = el.classList.contains("in");
      const targetOpacity =
        el.classList.contains("faintest") ? 0.32 :
        el.classList.contains("fainter") ? 0.6 :
        el.classList.contains("unsent-msg") ? 0.55 : 1;
      gsap.fromTo(
        el,
        { opacity: 0, y: 26, x: fromLeft ? -14 : 14, scale: 0.86, filter: "blur(6px)" },
        {
          opacity: targetOpacity, y: 0, x: 0, scale: 1, filter: "blur(0px)",
          duration: 0.9,
          ease: "back.out(1.5)",
          scrollTrigger: { trigger: el, start: "top 88%" },
        }
      );
    });

    // textos revelam com ritmo emocional
    document.querySelectorAll(".reveal").forEach((el) => {
      gsap.fromTo(
        el,
        { opacity: 0, y: 30, filter: "blur(5px)" },
        {
          opacity: 1, y: 0, filter: "blur(0px)",
          duration: 1.2,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 86%" },
        }
      );
    });

    // mensagens flutuam sutilmente depois de aparecer
    document.querySelectorAll(".msg.drift, .msg.glow-msg").forEach((el, idx) => {
      gsap.to(el, {
        y: "+=6",
        duration: 3 + idx,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
        delay: 1.2,
      });
    });

    // parallax delicado das bolhas ambiente
    gsap.to(".blob-a", {
      yPercent: 18,
      ease: "none",
      scrollTrigger: { trigger: document.body, start: "top top", end: "bottom bottom", scrub: 1.5 },
    });
    gsap.to(".blob-b", {
      yPercent: -14,
      ease: "none",
      scrollTrigger: { trigger: document.body, start: "top top", end: "bottom bottom", scrub: 2 },
    });
  } else {
    // fallback suave sem GSAP
    document.documentElement.classList.add("no-gsap");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("visible");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    document.querySelectorAll(".reveal, .msg").forEach((el) => io.observe(el));
  }

  /* ─────────── AMANHECER: a tela clareia perto do fim ─────────── */

  const dawnSections = ["cfinal", "antes", "ending", "finale"];
  const dawnObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const level = dawnSections.indexOf(e.target.id);
        if (level < 0) return;
        document.body.classList.remove("dawn-0", "dawn-1", "dawn-2", "dawn-3");
        document.body.classList.add("dawn-" + level);
      });
    },
    { threshold: 0.35 }
  );
  dawnSections.forEach((id) => {
    const el = document.getElementById(id);
    if (el) dawnObserver.observe(el);
  });

  /* ─────────── SEÇÃO DO SILÊNCIO: digitando que nunca completa ─────────── */

  const silenceTyping = document.getElementById("silence-typing");
  let silenceLoop = null;
  const silenceObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting && !silenceLoop) {
          const cycle = () => {
            silenceTyping.classList.add("on");
            silenceLoop = setTimeout(() => {
              silenceTyping.classList.remove("on");
              silenceLoop = setTimeout(cycle, 2600 + Math.random() * 2000);
            }, 2200 + Math.random() * 1600);
          };
          cycle();
        } else if (!e.isIntersecting && silenceLoop) {
          clearTimeout(silenceLoop);
          silenceLoop = null;
          silenceTyping.classList.remove("on");
        }
      });
    },
    { threshold: 0.2 }
  );
  if (silenceTyping) silenceObserver.observe(silenceTyping.closest(".silence"));

  /* ─────────── DIGITANDO FINAL: aparece e nunca envia ─────────── */

  const finalTyping = document.getElementById("final-typing");
  const finalObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        finalObserver.disconnect();
        setTimeout(() => finalTyping.classList.add("on"), 1400);
        setTimeout(() => {
          finalTyping.classList.remove("on");
          finalTyping.classList.add("off");
        }, 6500);
      });
    },
    { threshold: 0.6 }
  );
  if (finalTyping) finalObserver.observe(finalTyping);

  /* ─────────── CORAÇÕES: hover / toque solta corações ─────────── */

  function spawnHeart(x, y) {
    const h = document.createElement("span");
    h.className = "pop-heart";
    h.textContent = Math.random() > 0.4 ? "♥" : "♡";
    h.style.left = x + "px";
    h.style.top = y + "px";
    h.style.setProperty("--hx", (Math.random() * 60 - 30).toFixed(0) + "px");
    h.style.setProperty("--hr", (Math.random() * 40 - 20).toFixed(0) + "deg");
    h.style.fontSize = 0.8 + Math.random() * 0.7 + "rem";
    document.body.appendChild(h);
    setTimeout(() => h.remove(), 1450);
  }

  let lastHeart = 0;
  document.querySelectorAll(".heartable, .tiny-msg").forEach((el) => {
    const burst = (ev) => {
      const now = Date.now();
      if (now - lastHeart < 220) return; // com moderação
      lastHeart = now;
      const rect = el.getBoundingClientRect();
      const x = (ev.clientX || rect.left + rect.width / 2) + (Math.random() * 20 - 10);
      const y = (ev.clientY || rect.top) - 6;
      spawnHeart(x, y);
    };
    el.addEventListener("mouseenter", burst);
    el.addEventListener("click", (ev) => {
      burst(ev);
      setTimeout(() => burst(ev), 180);
      setTimeout(() => burst(ev), 360);
    });
  });

  /* ─────────── MENSAGEM APAGADA ─────────── */

  const deletedMsg = document.getElementById("deleted-msg");
  function revealDeleted() {
    if (!deletedMsg || deletedMsg.classList.contains("revealed")) return;
    deletedMsg.classList.add("revealed");
    const rect = deletedMsg.getBoundingClientRect();
    for (let i = 0; i < 5; i++) {
      setTimeout(
        () => spawnHeart(rect.left + Math.random() * rect.width, rect.top),
        i * 160
      );
    }
  }
  if (deletedMsg) deletedMsg.addEventListener("click", revealDeleted);

  /* ─────────── LIGAÇÃO ─────────── */

  const callAnswer = document.getElementById("call-answer");
  const answers = {
    yes: "chamando… ninguém atendeu. mas você tentou, e isso já diz tudo.",
    later: "amanhã você vai fingir que esqueceu. a madrugada sabe que não.",
  };
  function answerCall(kind) {
    callAnswer.textContent = answers[kind];
    callAnswer.classList.remove("show");
    void callAnswer.offsetWidth;
    callAnswer.classList.add("show");
  }
  document.getElementById("call-yes").addEventListener("click", () => answerCall("yes"));
  document.getElementById("call-later").addEventListener("click", () => answerCall("later"));

  /* ─────────── MENSAGEM NUNCA ENVIADA: digita sozinha ─────────── */

  const unsentText = document.getElementById("unsent-text");
  const unsentPhrase = "eu queria ter dito mais";
  const unsentObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        unsentObserver.disconnect();
        if (reduceMotion) return;
        unsentText.textContent = "";
        let i = 0;
        (function tick() {
          if (i <= unsentPhrase.length) {
            unsentText.textContent = unsentPhrase.slice(0, i);
            i++;
            setTimeout(tick, 85 + Math.random() * 70);
          }
        })();
      });
    },
    { threshold: 0.7 }
  );
  if (unsentText) unsentObserver.observe(unsentText.closest(".unsent"));

  /* ─────────── BOTÕES FINAIS ─────────── */

  // reviver a madrugada: volta ao começo, devagar
  document.getElementById("btn-revive").addEventListener("click", () => {
    document.body.classList.remove("dawn-1", "dawn-2", "dawn-3", "silent-mode");
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // ativar o silêncio: tudo desacelera e escurece
  document.getElementById("btn-silence").addEventListener("click", (ev) => {
    const on = document.body.classList.toggle("silent-mode");
    ev.target.textContent = on ? "🌫️ desativar o silêncio" : "🤍 ativar o silêncio";
  });

  // ler mensagens apagadas: leva de volta à confissão e revela
  document.getElementById("btn-deleted").addEventListener("click", () => {
    const target = document.getElementById("c4");
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(revealDeleted, 1400);
  });
})();
