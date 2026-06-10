import './style.css';
import { Game } from './game';
import { DeckBuilder } from './deckBuilder';

const app = document.getElementById('app')!;
const game = new Game(app);

game.start().then(() => {
  const loading = document.getElementById('loading')!;
  loading.classList.add('done');
  setTimeout(() => loading.remove(), 500);
  new DeckBuilder().show((ids) => game.beginMatch(ids));
});
