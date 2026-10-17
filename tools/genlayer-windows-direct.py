"""Only a gltest direct-mode Windows stdin shim, not a GenVM replacement."""
import os


def inject_message(vm):
    from genlayer.py import calldata
    from genlayer.py.types import Address
    def address(value):
        return Address(value) if isinstance(value, bytes) else value
    message = {
        'contract_address': address(vm._contract_address), 'sender_address': address(vm.sender),
        'origin_address': address(vm.origin), 'stack': [], 'value': vm._value,
        'datetime': vm._datetime, 'is_init': False, 'chain_id': vm._chain_id,
        'entry_kind': 0, 'entry_data': b'', 'entry_stage_data': None,
    }
    encoded = calldata.encode(message)
    assert len(encoded) < 4096
    read_fd, write_fd = os.pipe()
    try:
        assert os.write(write_fd, encoded) == len(encoded)
        vm._original_stdin_fd = os.dup(0)
        os.dup2(read_fd, 0)
    finally:
        os.close(read_fd)
        os.close(write_fd)
