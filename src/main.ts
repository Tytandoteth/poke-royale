import './style.css';
import { Game } from './game';
import { DeckBuilder } from './deckBuilder';
import { HomeScreen } from './screens/home';
import { SettingsScreen } from './screens/settings';
import { loadSettings, applySettings } from './settings';
import { recordResult } from './progression';

const app = document.getElementById('app')!;
const game = new Game(app);

game.start().then(() => {
  const loading = document.getElementById('loading')!;
  loading.classList.add('done');
  setTimeout(() => loading.remove(), 500);

  // restore saved audio + graphics settings
  applySettings(game, loadSettings());

  // record progression, then show the result with the trophy delta
  game.onMatchEnd = (result, crowns) => {
    const o = recordResult(result);
    game.ui.showEnd(result, crowns, {
      trophyDelta: o.trophyDelta,
      level: o.newLevel,
      leveledUp: o.leveledUp,
    });
  };

  showHome();
});

function showHome() {
  new HomeScreen().show({
    onPlay: (difficulty) => new DeckBuilder().show((ids) => game.beginMatch(ids, difficulty)),
    onSettings: () => new SettingsScreen(game).show(),
  });
}
