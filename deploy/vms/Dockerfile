# Built on the VPS from the go2rtc release binary already there, rather than pulled.
#
# Docker Hub blob fetches 403 from this network for some images (see GOTCHAS), and the binary is a
# static Go executable that needs nothing around it — so scratch is both the smallest and the most
# reliable base. No shell, no package manager, nothing to exploit if go2rtc is ever compromised.
FROM scratch

COPY go2rtc /go2rtc

# Nobody. go2rtc needs no filesystem, no privileged port and no identity.
USER 65534:65534

ENTRYPOINT ["/go2rtc"]
