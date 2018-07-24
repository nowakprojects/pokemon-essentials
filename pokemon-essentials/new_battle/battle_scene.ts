class NewBattle_Scene extends Scene_Base {
  battle: Battle_Manager;
  constructor() {
    super();
    let p1 = [];
    let p2 = [];
    for (let index = 0; index < 6; index++) {
      p1.push(PE.Pokemon.getRandomPokemon(100));
      p2.push(PE.Pokemon.getRandomPokemon(100));
    }
    this.battle = new Battle_Manager(p1, p2);
  }

  create() {}
  start() {
    this.battle.startBattle();
    EventManager.on('SWITCH_BATTLERS', this.switchBattlers);
  }

  update() {
    if (Input.isTriggered('ok')) {
      this.endActionsSelection();
      return;
    }
    this.battle.update();
  }

  endActionsSelection() {
    this.battle.endActionsSelection();
  }

  switchBattlers(battler) {
    console.log(battler);
  }
}
