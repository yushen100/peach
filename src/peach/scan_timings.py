"""扫描操作的累计耗时和单次峰值，不记录媒体路径。"""
from contextlib import contextmanager
from time import monotonic


class ScanTimings:
    def __init__(self):
        self._operations = {}

    def merge(self, operations):
        for name, stats in operations.items():
            current = self._operations.setdefault(name, [0, 0.0, 0.0])
            current[0] += stats[0]
            current[1] += stats[1]
            current[2] = max(current[2], stats[2])

    def record(self, name, started):
        elapsed = monotonic() - started
        self.merge({name: (1, elapsed, elapsed)})

    @contextmanager
    def measure(self, name):
        started = monotonic()
        try:
            yield
        finally:
            self.record(name, started)

    def call(self, name, operation, /, *args, **kwargs):
        with self.measure(name):
            return operation(*args, **kwargs)

    def snapshot(self):
        return {name: {'count': count, 'seconds': round(total, 6), 'max_seconds': round(peak, 6)}
                for name, (count, total, peak) in self._operations.items()}

    def totals(self):
        return self._operations
