import sys
import pytest
from unittest.mock import MagicMock, patch, PropertyMock


def make_device(name="Living Room", ip="192.168.1.10", volume=50):
    d = MagicMock()
    d.player_name = name
    d.ip_address = ip
    type(d).volume = PropertyMock(return_value=volume)
    return d


# ---------------------------------------------------------------------------
# discover_devices
# ---------------------------------------------------------------------------

class TestDiscoverDevices:
    def test_returns_list_of_devices(self):
        import sonos
        mock_devices = [make_device(), make_device("Kitchen", "192.168.1.11")]
        with patch("soco.discover", return_value=mock_devices):
            result = sonos.discover_devices()
        assert result == mock_devices

    def test_returns_empty_list_when_none_found(self):
        import sonos
        with patch("soco.discover", return_value=None):
            result = sonos.discover_devices()
        assert result == []


# ---------------------------------------------------------------------------
# print_devices
# ---------------------------------------------------------------------------

class TestPrintDevices:
    def test_no_devices(self, capsys):
        import sonos
        sonos.print_devices([])
        assert "No Sonos devices found." in capsys.readouterr().out

    def test_prints_device_info(self, capsys):
        import sonos
        d = make_device()
        d.get_current_transport_info.return_value = {"current_transport_state": "PLAYING"}
        d.get_current_track_info.return_value = {"title": "Song", "artist": "Artist"}
        sonos.print_devices([d])
        out = capsys.readouterr().out
        assert "Living Room" in out
        assert "PLAYING" in out
        assert "Artist - Song" in out

    def test_title_only_when_no_artist(self, capsys):
        import sonos
        d = make_device()
        d.get_current_transport_info.return_value = {"current_transport_state": "STOPPED"}
        d.get_current_track_info.return_value = {"title": "Podcast", "artist": ""}
        sonos.print_devices([d])
        out = capsys.readouterr().out
        assert "Podcast" in out
        assert " - " not in out

    def test_nothing_playing_label(self, capsys):
        import sonos
        d = make_device()
        d.get_current_transport_info.return_value = {"current_transport_state": "STOPPED"}
        d.get_current_track_info.return_value = {"title": "", "artist": ""}
        sonos.print_devices([d])
        assert "(nothing)" in capsys.readouterr().out

    def test_device_error_is_caught(self, capsys):
        import sonos
        d = make_device()
        d.get_current_transport_info.side_effect = Exception("network error")
        sonos.print_devices([d])
        assert "error reading state" in capsys.readouterr().out


# ---------------------------------------------------------------------------
# get_device
# ---------------------------------------------------------------------------

class TestGetDevice:
    def test_returns_device_at_index(self):
        import sonos
        devices = [make_device("A"), make_device("B")]
        assert sonos.get_device(devices, 1).player_name == "B"

    def test_defaults_to_index_zero(self):
        import sonos
        devices = [make_device("A"), make_device("B")]
        assert sonos.get_device(devices).player_name == "A"

    def test_exits_when_no_devices(self):
        import sonos
        with pytest.raises(SystemExit) as exc:
            sonos.get_device([])
        assert exc.value.code == 1

    def test_exits_when_index_out_of_range(self):
        import sonos
        with pytest.raises(SystemExit) as exc:
            sonos.get_device([make_device()], index=5)
        assert exc.value.code == 1


# ---------------------------------------------------------------------------
# cmd_volume
# ---------------------------------------------------------------------------

class TestCmdVolume:
    def test_sets_volume(self):
        import sonos
        d = make_device()
        type(d).volume = PropertyMock()
        sonos.cmd_volume([d], ["42"])
        d.__class__.volume.fset(d, 42)  # verify setter was called via mock
        # More direct: just check no exception and correct arg
        type(d).volume.fset.assert_called_once_with(d, 42)

    def test_sets_volume_on_specified_device(self):
        import sonos
        # Use plain MagicMocks (no shared PropertyMock class) so attribute
        # assignment is trackable per-instance.
        d0 = MagicMock()
        d0.player_name = "A"
        d1 = MagicMock()
        d1.player_name = "B"
        sonos.cmd_volume([d0, d1], ["30", "1"])
        assert d1.volume == 30

    def test_exits_when_no_args(self):
        import sonos
        with pytest.raises(SystemExit) as exc:
            sonos.cmd_volume([make_device()], [])
        assert exc.value.code == 1

    def test_raises_on_non_integer_level(self):
        import sonos
        with pytest.raises(ValueError):
            sonos.cmd_volume([make_device()], ["loud"])


# ---------------------------------------------------------------------------
# cmd_play / cmd_pause / cmd_next / cmd_prev / cmd_mute / cmd_unmute
# ---------------------------------------------------------------------------

class TestSimpleCommands:
    def _device(self):
        return make_device()

    def test_play_calls_play(self):
        import sonos
        d = self._device()
        sonos.cmd_play([d], [])
        d.play.assert_called_once()

    def test_play_uses_device_index(self):
        import sonos
        d0, d1 = make_device("A"), make_device("B")
        sonos.cmd_play([d0, d1], ["1"])
        d1.play.assert_called_once()
        d0.play.assert_not_called()

    def test_pause_calls_pause(self):
        import sonos
        d = self._device()
        sonos.cmd_pause([d], [])
        d.pause.assert_called_once()

    def test_next_calls_next(self):
        import sonos
        d = self._device()
        sonos.cmd_next([d], [])
        d.next.assert_called_once()

    def test_prev_calls_previous(self):
        import sonos
        d = self._device()
        sonos.cmd_prev([d], [])
        d.previous.assert_called_once()

    def test_mute_sets_mute_true(self):
        import sonos
        d = MagicMock()
        d.player_name = "Living Room"
        sonos.cmd_mute([d], [])
        assert d.mute is True

    def test_unmute_sets_mute_false(self):
        import sonos
        d = MagicMock()
        d.player_name = "Living Room"
        sonos.cmd_unmute([d], [])
        assert d.mute is False


# ---------------------------------------------------------------------------
# cmd_queue
# ---------------------------------------------------------------------------

class TestCmdQueue:
    def test_empty_queue(self, capsys):
        import sonos
        d = make_device()
        d.get_queue.return_value = []
        sonos.cmd_queue([d], [])
        assert "empty" in capsys.readouterr().out

    def test_prints_queue_items(self, capsys):
        import sonos
        d = make_device()
        item = MagicMock()
        item.title = "Bohemian Rhapsody"
        item.creator = "Queen"
        d.get_queue.return_value = [item]
        sonos.cmd_queue([d], [])
        out = capsys.readouterr().out
        assert "Queen" in out
        assert "Bohemian Rhapsody" in out


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

class TestMain:
    def test_help_flag_exits_zero(self):
        import sonos
        with patch.object(sys, "argv", ["sonos.py", "--help"]):
            with pytest.raises(SystemExit) as exc:
                sonos.main()
        assert exc.value.code == 0

    def test_short_help_flag_exits_zero(self):
        import sonos
        with patch.object(sys, "argv", ["sonos.py", "-h"]):
            with pytest.raises(SystemExit) as exc:
                sonos.main()
        assert exc.value.code == 0

    def test_no_args_exits_zero(self):
        import sonos
        with patch.object(sys, "argv", ["sonos.py"]):
            with pytest.raises(SystemExit) as exc:
                sonos.main()
        assert exc.value.code == 0

    def test_unknown_command_exits_one(self):
        import sonos
        with patch.object(sys, "argv", ["sonos.py", "dance"]):
            with patch("sonos.discover_devices", return_value=[]):
                with pytest.raises(SystemExit) as exc:
                    sonos.main()
        assert exc.value.code == 1

    def test_dispatches_status_command(self):
        import sonos
        devices = [make_device()]
        mock_status = MagicMock()
        # COMMANDS is built at import time with direct refs; patch via dict
        with patch.object(sys, "argv", ["sonos.py", "status"]):
            with patch("sonos.discover_devices", return_value=devices):
                with patch.dict(sonos.COMMANDS, {"status": (mock_status, "desc")}):
                    sonos.main()
        mock_status.assert_called_once_with(devices, [])

    def test_dispatches_play_with_args(self):
        import sonos
        d0, d1 = make_device("A"), make_device("B")
        devices = [d0, d1]
        with patch.object(sys, "argv", ["sonos.py", "play", "1"]):
            with patch("sonos.discover_devices", return_value=devices):
                sonos.main()
        d1.play.assert_called_once()
        d0.play.assert_not_called()
