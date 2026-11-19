"""Windows 独立包更新的发布签名（ADR-0137）。

每个版本的 `SHA256SUMS.txt` 由发布作业用 Ed25519 私钥签名，签名写在同目录的
`SHA256SUMS.txt.sig`，一行一个签名：`<公钥 base64> <签名 base64>`。更新器只认
`PUBLIC_KEYS` 里的公钥验过的摘要，不再采信 GitHub API 或 `releases.json` 给的 `digest`。
"""
from __future__ import annotations

import base64
import re

#: 受信任的发布签名公钥（base64，32 字节 Ed25519）。为空时更新器不要求签名；随某一版发出后，
#: 这一版起的客户端只装签名验得过的版本，发布作业缺私钥即失败。轮换见 ADR-0137。
PUBLIC_KEYS: tuple[str, ...] = ("xpyWoQnXok6/8msZPNCoaeO/zgmFAvoKbJCQg5w5dbc=",)
SUMS = "SHA256SUMS.txt"
SIGNATURE = SUMS + ".sig"
#: 签名内容的前缀：同一把私钥签出的别的东西不会被当成发布摘要。
CONTEXT = b"peach-release-sha256sums-v1\n"
MAX_BYTES = 1024 * 1024
_LINE = re.compile(r"([0-9a-f]{64}) [ *](?:\./)?([A-Za-z0-9_.-]+)")


def _key_bytes(text: str) -> bytes:
    raw = base64.b64decode(text, validate=True)
    if len(raw) != 32:
        raise ValueError("Ed25519 keys must be 32 bytes")
    return raw


def public_key(private_key: str) -> str:
    """私钥（32 字节 seed 的 base64，与 Sparkle 的 `--ed-key-file` 同一格式）对应的公钥。"""
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
    from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
    key = Ed25519PrivateKey.from_private_bytes(_key_bytes(private_key))
    return base64.b64encode(key.public_key().public_bytes(Encoding.Raw, PublicFormat.Raw)).decode("ascii")


def sign(sums: bytes, private_key: str) -> str:
    """签名文件里的一行。"""
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
    signature = Ed25519PrivateKey.from_private_bytes(_key_bytes(private_key)).sign(CONTEXT + sums)
    return f"{public_key(private_key)} {base64.b64encode(signature).decode('ascii')}\n"


def parse(sums: bytes) -> dict[str, str]:
    """`sha256sum` 的输出：文件名到摘要；同名出现两次视为无效。"""
    digests: dict[str, str] = {}
    for line in sums.decode("utf-8").splitlines():
        match = _LINE.fullmatch(line)
        if match is None or match[2] in digests:
            raise ValueError("invalid release checksum format")
        digests[match[2]] = match[1]
    if not digests:
        raise ValueError("release checksums are empty")
    return digests


def verify(sums: bytes, signature: bytes, keys: tuple[str, ...] | None = None) -> dict[str, str]:
    """有一行签名能被受信任公钥验过，才解析并返回摘要；否则抛 ValueError。"""
    from cryptography.exceptions import InvalidSignature
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
    trusted = PUBLIC_KEYS if keys is None else keys
    if len(sums) > MAX_BYTES or len(signature) > MAX_BYTES:
        raise ValueError("release signature file is too large")
    for line in signature.decode("ascii", "replace").splitlines():
        fields = line.split()
        # 不认得的行（受信任集合之外的公钥、以后的新格式）跳过，轮换期新旧签名可以并列。
        if len(fields) != 2 or fields[0] not in trusted:
            continue
        try:
            Ed25519PublicKey.from_public_bytes(_key_bytes(fields[0])).verify(
                base64.b64decode(fields[1], validate=True), CONTEXT + sums)
        except (InvalidSignature, ValueError):
            continue
        return parse(sums)
    raise ValueError("release signature verification failed")
