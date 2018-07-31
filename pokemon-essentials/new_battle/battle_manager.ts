const CHARACTERS_PER_LINE = 60;

enum Battle_Phase {
  Start = 'Start',
  Input = 'Input',
  Turn = 'Turn',
  Action = 'Action',
  BatledEnd = 'BatledEnd'
}

enum InputPhases {
  Action = 'Action',
  Move = 'Move',
  Item = 'Item',
  Party = 'Party',
  PartySwitchFainted = 'PartySwitchFainted'
}

enum BattleActionType {
  UseMove,
  UseItem,
  Switch,
  Run
}

interface IBattleAction {
  type: BattleActionType;
  /** The tragets slot indexes */
  targets: number[];
  move?: PE.Battle.Moves.Move;
  item?: PE.Itemdex;
  switchInIndex?: number;
}

class Battle_Manager {
  sides: {player: Battle_Side; foe: Battle_Side};

  private _actionsQueue: Battle_Battler[] = [];
  private _battlers: Battle_Battler[] = [];
  private _actives: Battle_Battler[] = [];
  /** The current active battler performing his selected action */
  private _subject: Battle_Battler = undefined;
  private _currentAction: IBattleAction = undefined;

  public phase: Battle_Phase | InputPhases = undefined;
  turn: number;
  constructor(public p1: PE.Pokemon.Pokemon[], public p2: PE.Pokemon.Pokemon[]) {
    console.log('Player Pokemons');
    console.log('==========================================================');
    console.log(p1.map(p => p.name));
    console.log('Foe Pokemons');
    console.log('==========================================================');
    console.log(p2.map(p => p.name));
    this.sides = {player: new Battle_Side(), foe: new Battle_Side()};
    for (const pokemon of this.p1) {
      let battler = new Battle_Battler(pokemon);
      battler.partyIndex = this.sides.player.party.length;
      battler.sides.own = this.sides.player;
      battler.sides.foe = this.sides.foe;
      this.sides.player.party.push(battler);
    }
    for (const pokemon of this.p2) {
      let battler = new Battle_Battler(pokemon);
      battler.partyIndex = this.sides.foe.party.length;
      battler.sides.own = this.sides.foe;
      battler.sides.foe = this.sides.player;
      this.sides.foe.party.push(battler);
    }
    this.turn = 0;
  }

  get actives() {
    return this.sides.player.slots.concat(this.sides.foe.slots);
  }

  update() {
    if (this.isBusy()) return;
    switch (this.phase) {
      case Battle_Phase.Start:
        this.startInput();
        break;
      case Battle_Phase.Turn:
        this.updateTurn();
        break;
      case Battle_Phase.Action:
        this.updateAction();
        break;
      case Battle_Phase.BatledEnd:
        SceneManager.goto(PE.TitleScenes.CustomScene);
        break;
    }
  }

  startBattle() {
    this.changePhase(Battle_Phase.Start);
    this.switchInStartBattlers();
    this.showStartMessages();
  }

  switchInStartBattlers() {
    this.sides.player.switchInStartBattlers();
    this.sides.foe.switchInStartBattlers();
  }
  showStartMessages() {}

  startInput() {
    // IA select moves
    // the battler actions input is handle in the battle scene
    this.changePhase(Battle_Phase.Input);
  }

  endActionsSelection() {
    this.dummyActionSelection();
    this.startTurn();
  }

  startTurn() {
    +this.turn++;
    console.log('----------------------------------------------------------');
    console.log(`# Turn ${this.turn}`);
    this.makeTurnOrder();
    this.changePhase(Battle_Phase.Turn);
  }

  isBusy() {}

  updateTurn() {
    if (!this._subject) {
      this._subject = this.getNextSubject();
    }
    if (this._subject) {
      this.processTurn();
    } else {
      this.endTurn();
    }
  }

  processTurn() {
    let action = this._subject.getAction();
    if (action) {
      this.startAction(action);
    } else {
      this._subject = this.getNextSubject();
    }
  }

  endTurn() {
    this.checkFaints();
    this.checkBattleEnd();
  }

  getNextSubject() {
    let battler = this._actionsQueue.shift();
    if (!battler) return null;
    if (!battler.isFainted()) return battler;
    return this.getNextSubject();
  }

  makeTurnOrder() {
    let battlers = [];
    battlers = battlers.concat(this.actives);
    battlers.sort((a, b) => this.getPriority(a, b));
    this._actionsQueue = battlers;
  }

  startAction(action) {
    this._currentAction = action;
    this.changePhase(Battle_Phase.Action);
  }

  updateAction() {
    switch (this._currentAction.type) {
      case BattleActionType.Switch:
        this.switchBattlers(this._currentAction.switchInIndex);
        this.endAction();
        break;
      case BattleActionType.UseMove:
        let target = this._currentAction.targets.shift();
        if (target != undefined) {
          this.useMove(this._currentAction.move, target);
        } else {
          this.endAction();
        }
        break;
      case BattleActionType.UseItem:
        this.endAction();
        break;
    }
  }

  endAction() {
    this._subject.clearAction();
    this._currentAction = undefined;
    this._subject = undefined;
    this.changePhase(Battle_Phase.Turn);
  }

  switchBattlers(partyIndex) {
    // this._subject.sides.own.switchBattlers(this._subject.slotIndex, partyIndex);
    let change = this._subject.sides.own.nextUnfaited(this._subject.partyIndex);
    this._subject.sides.own.switchBattlers(this._subject.slotIndex, change.partyIndex);
  }

  useMove(move: PE.Battle.Moves.Move, target) {
    console.log(`> ${this._subject.species} used ${move.name} --> ${this._subject.sides.foe.slots[target].species}`);
    this.showMessage(`${this._subject.name} used  ${move.name}!`);
    let foe = this._subject.sides.foe.slots[target];
    let damage = this.calculateDamage(this._subject, foe, move);
    foe.damage(damage);
  }

  getPriority(a: Battle_Battler, b: Battle_Battler) {
    if (b.getAction().type - a.getAction().type) {
      return b.getAction().type - a.getAction().type;
    }
    if (b.speed - a.speed) {
      return b.speed - a.speed;
    }
    return Math.random() - 0.5;
  }

  checkFaints() {
    for (const battler of this.sides.player.actives) {
      if (battler.isFainted() && !battler.sides.own.areAllFainted()) {
        // this.changePhase(InputPhases.PartySwitchFainted);
        let change = battler.sides.own.nextUnfaited();
        battler.sides.own.switchBattlers(battler.slotIndex, change.partyIndex);
      }
    }
    for (const battler of this.sides.foe.actives) {
      if (battler.isFainted() && !battler.sides.own.areAllFainted()) {
        let change = battler.sides.own.nextUnfaited();
        battler.sides.own.switchBattlers(battler.slotIndex, change.partyIndex);
      }
    }
  }

  checkBattleEnd() {
    if (this.sides.foe.areAllFainted()) {
      this.processVictory();
    }
    if (this.sides.player.areAllFainted()) {
      this.processDefead();
    }
  }

  processVictory() {
    console.log('# VICTORY');
    console.log('==========================================================');
    this.showMessage('Visctory');
    this.changePhase(Battle_Phase.BatledEnd);
  }
  processDefead() {
    console.log('# DEFEAT');
    console.log('==========================================================');
    this.showMessage('defeat');
    this.changePhase(Battle_Phase.BatledEnd);
  }

  changePhase(phase: Battle_Phase | InputPhases) {
    // console.log("Battle Phase: " + phase);
    this.phase = phase;
  }

  dummyActionSelection() {
    for (const battler of this.actives) {
      let action: IBattleAction = undefined;
      if (PE.Utils.chance(20) && battler.sides.own.nextUnfaited(battler.partyIndex)) {
        action = {
          targets: [0],
          type: BattleActionType.Switch,
          switchInIndex: 0
        };
      } else {
        action = {
          targets: [0],
          type: BattleActionType.UseMove,
          move: battler.getFirstDamageMove()
        };
      }
      battler.setAction(action);
    }
  }

  calculateDamage(source: Battle_Battler, target: Battle_Battler, move: PE.Battle.Moves.Move) {
    // http://bulbapedia.bulbagarden.net/wiki/Damage
    let atk = 0;
    let def = 0;
    if (move.category == PE.Battle.Moves.Categories.Special) {
      atk = source.spatk;
      def = target.spdef;
    } else if (move.category == PE.Battle.Moves.Categories.Physical) {
      atk = source.attack;
      def = target.defense;
    } else {
      return 0;
    }
    let effectiveness = PE.Types.effectiveness(move.type, target.types);
    let msg = null;
    if (effectiveness <= 0.5) {
      msg = `It's not very effective...`;
    } else if (effectiveness >= 2) {
      msg = `It's super effective!`;
    } else if (effectiveness == 0) {
      msg = `It doesn't affect ${target.name}`;
    }
    if (msg) {
      console.log('~ ' + msg);
      this.showMessage(msg);
    }

    let stab = source.hasType(move.type) ? 1.5 : 1;
    let critical = 1;
    let random = Math.random() * 100;
    if (PE.Utils.chance(6.25)) {
      critical = 1.5;
      console.log('~ critical hit!');
      this.showMessage('critical hit!');
      // PE_BattleControl.push('showMessage', "critical hit");
    }
    random = Math.random() * (1 - 0.81) + 0.81;
    let modifier = critical * random * stab * effectiveness;
    let power = move.basePower;
    let damage = ((((2 * source.level) / 5 + 2) * power * (atk / def)) / 50 + 2) * modifier;
    return Math.floor(damage);
  }

  showMessage(msg: string) {
    msg = PE.Utils.capitalize(msg);
    while (msg.length > CHARACTERS_PER_LINE) {
      let line = msg.substring(0, CHARACTERS_PER_LINE);
      let truncateIndex = Math.min(line.length, line.lastIndexOf(' '));
      line = line.substring(0, truncateIndex);
      $gameMessage.add(line + '\\n');
      msg = msg.substring(truncateIndex + 1);
    }
    $gameMessage.add(msg + '\\|\\^');
  }

  showPausedMessage(msg: string) {
    msg = PE.Utils.capitalize(msg);
    while (msg.length > CHARACTERS_PER_LINE) {
      let line = msg.substring(0, CHARACTERS_PER_LINE);
      let truncateIndex = Math.min(line.length, line.lastIndexOf(' '));
      line = line.substring(0, truncateIndex + 1);
      $gameMessage.add(line + '\\n');
      msg = msg.substring(truncateIndex + 1);
    }
    $gameMessage.add(msg);
  }
}
