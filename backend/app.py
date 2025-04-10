from flask import jsonify
from flask_jwt_extended import verify_jwt_in_request
from flask_jwt_extended import get_jwt_claims
from datetime import datetime, timedelta
from sqlalchemy import func
from backend.models import CellRecord
from backend.database import db

@admin_routes.route('/admin/currently_connected_devices', methods=['GET'])
def currently_connected_devices():
    verify_admin_token()
    time_threshold = datetime.utcnow() - timedelta(minutes=5)
    
    print(f"Current time: {datetime.utcnow()}")
    print(f"Time threshold: {time_threshold}")

    # Get devices that have sent data in the last 5 minutes
    active_devices = db.session.query(
        CellRecord.username,
        CellRecord.device_id,
        CellRecord.device_ip,
        CellRecord.device_mac
    ).filter(CellRecord.timestamp >= time_threshold).distinct().all()
    
    print(f"Active devices (last 5 minutes): {active_devices}")

    # Get the most recent record for each device to check their last activity
    latest_records = db.session.query(
        CellRecord.username,
        CellRecord.device_id,
        func.max(CellRecord.timestamp).label('last_seen')
    ).group_by(CellRecord.username, CellRecord.device_id).all()
    
    print(f"Latest records: {latest_records}")

    # Create a set of active devices for quick lookup
    active_device_set = {(d.username, d.device_id) for d in active_devices}
    print(f"Active device set: {active_device_set}")

    # Get all unique devices that have ever connected
    all_devices = db.session.query(
        CellRecord.username,
        CellRecord.device_id,
        CellRecord.device_ip,
        CellRecord.device_mac
    ).distinct().all()
    
    print(f"All devices: {all_devices}")

    # Filter devices based on their last activity
    connected_devices = []
    for device in all_devices:
        # Find the last seen timestamp for this device
        last_seen = next((r.last_seen for r in latest_records 
                         if r.username == device.username and r.device_id == device.device_id), None)
        
        print(f"Device: {device.username}, {device.device_id}, Last seen: {last_seen}")
        
        # Include device if:
        # 1. It's in the active devices set (sent data in last 5 minutes), or
        # 2. It has a last_seen timestamp within the last 5 minutes
        if (device.username, device.device_id) in active_device_set or \
           (last_seen and last_seen >= time_threshold):
            connected_devices.append({
                "username": device.username,
                "device_id": device.device_id,
                "ip": device.device_ip,
                "mac": device.device_mac
            })

    print(f"Final connected devices: {connected_devices}")
    return jsonify(connected_devices) 