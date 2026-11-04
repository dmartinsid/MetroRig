import type { Session } from '../app/session';
import { GENRE_TABS, songsForGenre, type GenreTab, type Song } from '../domain/songs';
import { byId } from './dom';

// The genre tabs and the song cards
export function mount(session: Session): void {
  const genreTabs = byId('genre-tabs');
  const songGrid = byId('song-grid');

  let activeGenre: GenreTab = 'All';

  function drawGenreTabs() {
    genreTabs.innerHTML = '';
    GENRE_TABS.forEach(genre => {
      const tab = document.createElement('button');
      tab.className = 'genre-tab';
      tab.innerText = genre;
      tab.setAttribute('aria-pressed', String(genre === activeGenre));
      tab.onclick = () => {
        activeGenre = genre;
        drawGroovesScreen();
      };
      genreTabs.appendChild(tab);
    });
  }

  function songCard(song: Song) {
    const card = document.createElement('article');
    card.className = 'song-card card';
    card.setAttribute('data-song', song.id);

    const texts: [string, string][] = [
      ['song-title', song.title],
      ['song-artist', song.artist],
      ['song-section', song.section],
      ['song-bpm', `${song.bpm} BPM`],
      ['song-meter', song.timeSignature],
    ];
    texts.forEach(([className, text]) => {
      const line = document.createElement('span');
      line.className = className;
      line.innerText = text;
      card.appendChild(line);
    });

    const play = document.createElement('button');
    play.className = 'song-play';
    play.setAttribute('data-song', song.id);
    play.setAttribute('aria-label', `Play ${song.title}`);
    play.onclick = () => session.playSong(song);
    card.appendChild(play);

    const open = document.createElement('button');
    open.className = 'song-open';
    open.innerText = 'Open in Editor';
    open.onclick = () => {
      if (session.useSong(song)) session.setView('editor');
    };
    card.appendChild(open);
    return card;
  }

  function updateSongCards() {
    songGrid.querySelectorAll<HTMLElement>('.song-play').forEach(button => {
      const playing = session.isPlaying && session.preset.id === button.dataset.song;
      button.innerText = playing ? '■' : '▶';
    });
  }

  function drawGroovesScreen() {
    drawGenreTabs();
    songGrid.innerHTML = '';
    songsForGenre(activeGenre).forEach(song => songGrid.appendChild(songCard(song)));
    updateSongCards();
  }

  session.subscribe(change => {
    if (change === 'playback' || change === 'preset' || change === 'library') updateSongCards();
  });

  drawGroovesScreen();
}
