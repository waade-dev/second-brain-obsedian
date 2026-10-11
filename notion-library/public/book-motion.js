// Keep the lifting cover and its hinge inside the reader, in one coordinate space.
export function animateBookOpening(dialog, trigger, fallbackCover) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  const source = trigger?.matches('.concept-book') ? trigger : fallbackCover;
  const cover = source?.querySelector('.book-cover');
  const spread = dialog.querySelector('.open-book-spread');
  if (!cover || !spread) return () => {};

  const mobile = window.matchMedia('(max-width: 700px)').matches;
  const stage = document.createElement('div');
  stage.className = 'book-motion-stage';
  stage.setAttribute('aria-hidden', 'true');
  const book = document.createElement('div');
  book.className = 'reader-book';
  const pages = document.createElement('div');
  pages.className = 'reader-book-pages';
  const hinge = document.createElement('div');
  hinge.className = 'reader-book-hinge';
  const front = cover.cloneNode(true);
  front.classList.add('reader-book-front');
  const back = document.createElement('div');
  back.className = 'reader-book-back';
  hinge.append(front, back);
  book.append(pages, hinge);
  stage.append(book);
  dialog.append(stage);
  source.classList.add('book-in-flight');
  dialog.classList.add('is-opening', 'is-lifting');
  spread.inert = true;

  const animations = [];
  let finished = false;
  const cleanup = () => {
    if (finished) return;
    finished = true;
    window.removeEventListener('resize', cleanup);
    animations.forEach(animation => animation.cancel());
    stage.remove();
    source.classList.remove('book-in-flight');
    dialog.classList.remove('is-opening', 'is-lifting');
    spread.inert = false;
  };
  // A resize switches immediately to the readable, correctly sized final spread.
  window.addEventListener('resize', cleanup, {once: true});
  const rise = book.animate([
    {opacity: 0, transform: 'translateY(44px) scale(.9) rotateZ(-2deg)'},
    {opacity: 1, transform: 'translateY(12px) scale(.98) rotateZ(-.5deg)', offset: .55},
    {opacity: 1, transform: 'translateY(0) scale(1) rotateZ(0deg)'}
  ], {duration: 440, easing: 'cubic-bezier(.18,.75,.25,1)', fill: 'forwards'});
  animations.push(rise);

  (async () => {
    try {
      await rise.finished;
      if (finished) return;
      dialog.classList.remove('is-lifting');
      const reveal = spread.animate([{opacity: 0}, {opacity: 1}], {
        duration: 420, delay: 160, easing: 'ease-out', fill: 'forwards'
      });
      const opening = hinge.animate([
        {transform: 'rotateY(0deg)'},
        {transform: 'rotateY(-75deg)', offset: .48},
        {transform: `rotateY(${mobile ? '-112' : '-180'}deg)`}
      ], {duration: 860, easing: 'cubic-bezier(.35,.05,.25,1)', fill: 'forwards'});
      // Fade the page block as the real chapter page underneath is exposed.
      const pagesAway = pages.animate([{opacity: 1}, {opacity: 0}], {
        duration: 180, delay: 260, fill: 'forwards'
      });
      animations.push(reveal, opening, pagesAway);
      await opening.finished;
      if (finished) return;
      dialog.classList.remove('is-opening');
      const settle = stage.animate([{opacity: 1}, {opacity: 0}], {
        duration: 170, easing: 'ease-out', fill: 'forwards'
      });
      animations.push(settle);
      await settle.finished;
      cleanup();
    } catch {
      cleanup();
    }
  })();
  return cleanup;
}
