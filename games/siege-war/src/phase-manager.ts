/**
 * PhaseManager — 阶段管理
 * 试探 → 推进 → 总攻 → 巷战, 含守方喘息期
 */
export enum BattlePhase {
  Probing = 'probing',
  Advance = 'advance',
  Assault = 'assault',
  StreetFight = 'street_fight',
  BreathingTime = 'breathing',
}

// TODO: PhaseManager class
// - check(dt): 根据战场状态判断是否推进到下一阶段
// - getCurrentPhase(): 返回当前阶段
// - onPhaseChange(): 触发阶段切换事件(BGM切换等)
