import time
from dataclasses import dataclass, field
from typing import Optional
from app.config import get_settings

settings = get_settings()


@dataclass
class RiskSignals:
    request_rate_high: bool = False
    failed_logins: int = 0
    missing_browser_headers: bool = False
    impossible_sequence: bool = False
    endpoint_enumeration: bool = False
    automation_indicators: bool = False
    many_accounts_from_device: int = 0
    many_devices_from_ip: int = 0
    repeated_credential_attacks: int = 0
    known_bad_ua: bool = False
    missing_accept: bool = False
    ua_sec_ch_ua_mismatch: bool = False


@dataclass
class RiskResult:
    score: int = 0
    level: str = "NORMAL"
    signals: RiskSignals = field(default_factory=RiskSignals)

    @property
    def should_challenge(self) -> bool:
        return self.score >= settings.RISK_THRESHOLD_CHALLENGE

    @property
    def should_block_temp(self) -> bool:
        return self.score >= settings.RISK_THRESHOLD_BLOCK_TEMP

    @property
    def should_block_perm(self) -> bool:
        return self.score >= settings.RISK_THRESHOLD_BLOCK_PERM

    @property
    def is_suspicious(self) -> bool:
        return self.score >= settings.RISK_THRESHOLD_SUSPICIOUS


def calculate_risk(signals: RiskSignals) -> RiskResult:
    score = 0

    if signals.request_rate_high:
        score += 10
    if signals.failed_logins >= 3:
        score += 15
    if signals.missing_browser_headers:
        score += 20
    if signals.impossible_sequence:
        score += 15
    if signals.endpoint_enumeration:
        score += 20
    if signals.automation_indicators:
        score += 25
    if signals.many_accounts_from_device > 3:
        score += 20
    if signals.many_devices_from_ip > 10:
        score += 30
    if signals.repeated_credential_attacks > 10:
        score += 40
    if signals.known_bad_ua:
        score += 25
    if signals.missing_accept:
        score += 10
    if signals.ua_sec_ch_ua_mismatch:
        score += 15

    if score >= settings.RISK_THRESHOLD_BLOCK_PERM:
        level = "BLOCK_PERM"
    elif score >= settings.RISK_THRESHOLD_BLOCK_TEMP:
        level = "BLOCK_TEMP"
    elif score >= settings.RISK_THRESHOLD_CHALLENGE:
        level = "CHALLENGE"
    elif score >= settings.RISK_THRESHOLD_SUSPICIOUS:
        level = "SUSPICIOUS"
    else:
        level = "NORMAL"

    return RiskResult(score=score, level=level, signals=signals)
