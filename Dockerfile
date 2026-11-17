# syntax=docker/dockerfile:1
FROM ghcr.io/astral-sh/uv:0.13.8 AS uv
FROM python:3.15.2-slim-trixie AS build
COPY --from=uv /uv /usr/local/bin/uv
WORKDIR /app
ENV UV_PYTHON_DOWNLOADS=never UV_LINK_MODE=copy
RUN apt-get update && apt-get install -y --no-install-recommends build-essential git \
    && rm -rf /var/lib/apt/lists/*
COPY pyproject.toml uv.lock README.md LICENSE setup.py MANIFEST.in ./
COPY src ./src
COPY migrations ./migrations
COPY web ./web
COPY resources ./resources
COPY tools/amane-bridge ./tools/amane-bridge
COPY scripts/write_reporting_config.py ./scripts/
# write_reporting_config.py 的说明与报错由 scripts/locales 渲染（ADR-0159 第三条），构建阶段要带上。
COPY scripts/locales ./scripts/locales
COPY scripts/build_amane_runtime.py scripts/amane_bridge.spec ./scripts/
# vision 带上 OpenCV：镜像里随附的人脸模型要靠它才能检出与比对。
RUN uv sync --locked --no-dev --no-editable --extra vision
# ONNX Runtime 的 wheel 覆盖 Python 3.14，OCR 按独立清单准备兼容解释器。
RUN UV_PYTHON_DOWNLOADS=automatic UV_PYTHON_INSTALL_DIR=/app/ocr-python \
    UV_PROJECT_ENVIRONMENT=/app/ocr-runtime/.venv \
    uv sync --locked --no-dev --python 3.14 --project resources/ocr/environment
RUN .venv/bin/python -X utf8 scripts/build_amane_runtime.py --kind python \
    --destination /app/amane-runtime --work /app/build/amane-runtime
# 公开 DSN 写进 wheel 的资源目录；发行流水线传 PEACH_REQUIRE_REPORTING=1，缺失时构建失败。
ARG PEACH_SENTRY_DSN="" PEACH_LIBRARY_SENTRY_DSN="" PEACH_REQUIRE_REPORTING=""
RUN target="$(.venv/bin/python -c 'import pathlib, peach; print(pathlib.Path(peach.__file__).parent / "_resources" / "sentry.json")')" \
    && .venv/bin/python scripts/write_reporting_config.py --output "$target" ${PEACH_REQUIRE_REPORTING:+--require}

FROM python:3.15.2-slim-trixie
LABEL org.opencontainers.image.title="Peach" \
      org.opencontainers.image.source="https://github.com/peach-mitao/peach" \
      org.opencontainers.image.documentation="https://github.com/peach-mitao/peach/blob/master/docs/DOCKER.md" \
      org.opencontainers.image.licenses="AGPL-3.0-or-later"
# amane 独立环境在构建阶段准备，空数据卷可直接调用。
# Intel iHD 驱动 Debian 只出 amd64 包；arm64 镜像只带 Mesa VAAPI。
RUN intel=""; if [ "$(dpkg --print-architecture)" = amd64 ]; then intel="intel-media-va-driver=25.2.3+dfsg1-1"; fi     && apt-get update && apt-get install -y --no-install-recommends ffmpeg openssl ca-certificates mesa-va-drivers vainfo $intel \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 1000 peach && useradd --uid 1000 --gid 1000 --create-home peach \
    && mkdir /data && chown peach:peach /data
# 人脸模型与许可证随镜像分发，地址与哈希同 scripts/fetch_face_models.py，运行时经 PEACH_FACE_MODELS 读取。
ADD --chmod=a+rX --checksum=sha256:8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4 \
    https://media.githubusercontent.com/media/opencv/opencv_zoo/48b10fa505aeb51fbd127fc60a5c660040e823b7/models/face_detection_yunet/face_detection_yunet_2023mar.onnx \
    /app/tools/face-models/face_detection_yunet_2023mar.onnx
ADD --chmod=a+rX --checksum=sha256:0ba9fbfa01b5270c96627c4ef784da859931e02f04419c829e83484087c34e79 \
    https://media.githubusercontent.com/media/opencv/opencv_zoo/48b10fa505aeb51fbd127fc60a5c660040e823b7/models/face_recognition_sface/face_recognition_sface_2021dec.onnx \
    /app/tools/face-models/face_recognition_sface_2021dec.onnx
ADD --chmod=a+rX --checksum=sha256:c83b8120c50ccbd4c4f96edf53141bdd566ebb8f8e9227e415326aa1b1aba958 \
    https://raw.githubusercontent.com/opencv/opencv_zoo/48b10fa505aeb51fbd127fc60a5c660040e823b7/models/face_detection_yunet/LICENSE \
    /app/tools/face-models/LICENSE-yunet.txt
ADD --chmod=a+rX --checksum=sha256:cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30 \
    https://raw.githubusercontent.com/opencv/opencv_zoo/48b10fa505aeb51fbd127fc60a5c660040e823b7/models/face_recognition_sface/LICENSE \
    /app/tools/face-models/LICENSE-sface.txt
# 封面取景的文字检测、书脊番号识别与身体部位检测模型同目录分发（`peach.avatar_watermark`、`spine_label`、`body_parts`）。
ADD --chmod=a+rX --checksum=sha256:03f550c6b406fda8bf54bd8327815f6c7e2edd98cea02348c93d879254366587 \
    https://media.githubusercontent.com/media/opencv/opencv_zoo/48b10fa505aeb51fbd127fc60a5c660040e823b7/models/text_detection_ppocr/text_detection_en_ppocrv3_2023may.onnx \
    /app/tools/face-models/text_detection_en_ppocrv3_2023may.onnx
ADD --chmod=a+rX --checksum=sha256:a84b1f6e11a65c2d733cb0cc1f014aae3f99051e3f11447dc282faa678eee544 \
    https://media.githubusercontent.com/media/opencv/opencv_zoo/48b10fa505aeb51fbd127fc60a5c660040e823b7/models/text_recognition_crnn/text_recognition_CRNN_EN_2021sep.onnx \
    /app/tools/face-models/text_recognition_CRNN_EN_2021sep.onnx
ADD --chmod=a+rX --checksum=sha256:609aaac97719da6b71cd3ffd08b5de08b75f582e5c50a196fab522b6d5087714 \
    https://raw.githubusercontent.com/opencv/opencv_zoo/48b10fa505aeb51fbd127fc60a5c660040e823b7/models/text_detection_ppocr/LICENSE \
    /app/tools/face-models/LICENSE-ppocr.txt
ADD --chmod=a+rX --checksum=sha256:cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30 \
    https://raw.githubusercontent.com/opencv/opencv_zoo/48b10fa505aeb51fbd127fc60a5c660040e823b7/models/text_recognition_crnn/LICENSE \
    /app/tools/face-models/LICENSE-crnn.txt
# 推广画面 OCR 的固定 small 模型，运行时同样核对 SHA-256。
ADD --chmod=a+rX --checksum=sha256:090f04abcd9d9a7498bc4ebf677e4cb9bdce1fe4197ddb7e529f1ef44e1ff94f \
    https://www.modelscope.cn/models/RapidAI/RapidOCR/resolve/v3.10.0/onnx/PP-OCRv6/det/PP-OCRv6_det_small.onnx \
    /app/tools/face-models/PP-OCRv6_det_small.onnx
ADD --chmod=a+rX --checksum=sha256:e47acedf663230f8863ff1ab0e64dd2d82b838fceb5957146dab185a89d6215c \
    https://www.modelscope.cn/models/RapidAI/RapidOCR/resolve/v3.10.0/onnx/PP-OCRv4/cls/ch_ppocr_mobile_v2.0_cls_mobile.onnx \
    /app/tools/face-models/ch_ppocr_mobile_v2.0_cls_mobile.onnx
ADD --chmod=a+rX --checksum=sha256:6f327246b50388f3c176ae304bd95767ea6dc0c9ae92153ef8cbe210b3c14884 \
    https://www.modelscope.cn/models/RapidAI/RapidOCR/resolve/v3.10.0/onnx/PP-OCRv6/rec/PP-OCRv6_rec_small.onnx \
    /app/tools/face-models/PP-OCRv6_rec_small.onnx
ADD --checksum=sha256:5937dbd84e5d8e5de038f08ffea5a1bb50a08475776bf2b4795914ce0eaf0331 \
    https://files.pythonhosted.org/packages/1c/ee/1aa02d44ba958cc77e16ff1e41a0aac5e721037db7bf62b9c9d124917f87/nudenet-3.4.2-py3-none-any.whl \
    /tmp/nudenet-3.4.2-py3-none-any.whl
COPY --from=build /app/.venv /app/.venv
# NudeNet 的模型在 wheel 里：整包哈希已在 ADD 时核过，解出模型与许可证后删掉 wheel。
RUN /app/.venv/bin/python -c "import zipfile; z = zipfile.ZipFile('/tmp/nudenet-3.4.2-py3-none-any.whl'); \
open('/app/tools/face-models/320n.onnx', 'wb').write(z.read('nudenet/320n.onnx')); \
open('/app/tools/face-models/LICENSE-nudenet.txt', 'wb').write(z.read('nudenet-3.4.2.dist-info/LICENSE'))" \
    && chmod a+r /app/tools/face-models/320n.onnx /app/tools/face-models/LICENSE-nudenet.txt \
    && rm /tmp/nudenet-3.4.2-py3-none-any.whl
COPY --from=build /app/amane-runtime /app/amane-runtime
COPY --from=build /app/ocr-runtime /app/ocr-runtime
COPY --from=build /app/ocr-python /app/ocr-python
COPY --from=build /app/tools/amane-bridge /app/tools/amane-bridge
RUN /app/amane-runtime/.venv/bin/python -X utf8 /app/tools/amane-bridge/bridge.py --self-check
# 一键更新的令牌目录：compose 在这里挂 peach-update 卷，空卷首次挂载时照搬这个目录的属主（ADR-0140）。
RUN mkdir /update && chown peach:peach /update
ENV PATH="/app/.venv/bin:$PATH" PEACH_DATA_ROOT=/data PYTHONUNBUFFERED=1 \
    PYTHONIOENCODING=utf-8 PYTHONUTF8=1 PEACH_FACE_MODELS=/app/tools/face-models PEACH_DISTRIBUTION=docker \
    PEACH_AMANE_RUNTIME=/app/amane-runtime PEACH_UPDATE_DIR=/update \
    PEACH_OCR_PYTHON=/app/ocr-runtime/.venv/bin/python
WORKDIR /data
# 入口先以 root 修正已有 /data 卷的所有者，再降权到 PEACH_UID/PEACH_GID。
USER root
EXPOSE 8900
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8900/healthz?ready=1', timeout=3).read()"]
ENTRYPOINT ["python", "-m", "peach.docker_entrypoint"]
CMD ["python", "-m", "peach.server"]
