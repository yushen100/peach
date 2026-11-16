"""带尾部视频 Cues 的 Matroska 元数据样本。"""
from ebmlite.encoding import encodeId, encodeSize


def element(kind: int, body: bytes) -> bytes:
    return encodeId(kind) + encodeSize(len(body)) + body


def uint(kind: int, value: int) -> bytes:
    return element(kind, value.to_bytes(8, "big"))


def minimal_mkv(times=(0, 2500, 5000, 7500, 10000), *, scale=1_000_000,
                media_bytes=128 << 10, cues=True) -> bytes:
    info = element(0x1549A966, uint(0x2AD7B1, scale))
    tracks = element(0x1654AE6B, element(0xAE, uint(0xD7, 1) + uint(0x83, 2))
                     + element(0xAE, uint(0xD7, 2) + uint(0x83, 1)))
    index = element(0x1C53BB6B, b"".join(
        element(0xBB, uint(0xB3, time) + element(0xB7, uint(0xF7, track) + uint(0xF1, 0)))
        for time, track in [(123, 1), *((value, 2) for value in times)]))
    cluster = element(0x1F43B675, bytes(media_bytes))

    def seek_head(info_at, tracks_at, cues_at):
        return element(0x114D9B74, b"".join(element(0x4DBB,
            element(0x53AB, encodeId(kind)) + uint(0x53AC, position))
            for kind, position in ((0x1549A966, info_at), (0x1654AE6B, tracks_at),
                                   *(([(0x1C53BB6B, cues_at)]) if cues else []))))

    head_size = len(seek_head(0, 0, 0))
    head = seek_head(head_size, head_size + len(info), head_size + len(info) + len(tracks) + len(cluster))
    return (element(0x1A45DFA3, element(0x4282, b"matroska"))
            + encodeId(0x18538067) + encodeSize(None, 1)
            + head + info + tracks + cluster + (index if cues else b""))
