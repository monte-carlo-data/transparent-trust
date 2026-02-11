#!/bin/bash
# Stop the RDS bastion instance
# Usage: ./scripts/rds-bastion-stop.sh

set -e

INSTANCE_ID="i-0bedcec8aa238b93b"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check current state
INSTANCE_STATE=$(aws ec2 describe-instances --instance-ids "$INSTANCE_ID" --query 'Reservations[0].Instances[0].State.Name' --output text)

if [ "$INSTANCE_STATE" = "stopped" ]; then
    echo -e "${GREEN}Bastion instance is already stopped${NC}"
    exit 0
fi

if [ "$INSTANCE_STATE" = "stopping" ]; then
    echo -e "${YELLOW}Bastion instance is already stopping...${NC}"
    exit 0
fi

echo -e "${YELLOW}Stopping bastion instance...${NC}"
aws ec2 stop-instances --instance-ids "$INSTANCE_ID" > /dev/null

echo -e "${GREEN}Stop command sent. Instance will be stopped shortly.${NC}"
