#!/bin/bash

# Solana Event Monitor Script
# This script helps monitor and manage the Solana event indexer

echo "🔍 Solana Event Monitor"
echo "========================"

# Function to check canister status
check_status() {
    echo "📊 Checking canister status..."
    dfx canister status cross_nft_launcher_backend
    echo ""
}

# Function to get indexer state
get_state() {
    echo "📋 Getting indexer state..."
    dfx canister call cross_nft_launcher_backend get_solana_indexer_state
    echo ""
}

# Function to get latest events
get_events() {
    echo "📈 Getting latest events..."
    dfx canister call cross_nft_launcher_backend get_latest_solana_events '(10:nat32)'
    echo ""
}

# Function to manually trigger indexing
trigger_index() {
    echo "🔄 Triggering manual indexing..."
    dfx canister call cross_nft_launcher_backend call_solana_indexer
    echo ""
}

# Function to start monitoring
start_monitoring() {
    echo "▶️  Starting Solana monitoring..."
    dfx canister call cross_nft_launcher_backend start_solana_monitoring
    echo ""
}

# Function to stop monitoring
stop_monitoring() {
    echo "⏹️  Stopping Solana monitoring..."
    dfx canister call cross_nft_launcher_backend stop_solana_monitoring
    echo ""
}

# Function to restart monitoring
restart_monitoring() {
    echo "🔄 Restarting Solana monitoring..."
    dfx canister call cross_nft_launcher_backend restart_solana_monitoring
    echo ""
}

# Function to add cycles
add_cycles() {
    local cycles=${1:-100000000000}
    echo "💰 Adding $cycles cycles..."
    dfx canister deposit-cycles $cycles cross_nft_launcher_backend
    echo ""
}

# Main menu
show_menu() {
    echo "Choose an option:"
    echo "1) Check canister status"
    echo "2) Get indexer state"
    echo "3) Get latest events"
    echo "4) Trigger manual indexing"
    echo "5) Start monitoring"
    echo "6) Stop monitoring"
    echo "7) Restart monitoring"
    echo "8) Add cycles (100B default)"
    echo "9) Monitor continuously (every 30s)"
    echo "0) Exit"
    echo ""
}

# Continuous monitoring
monitor_continuous() {
    echo "🔄 Starting continuous monitoring (press Ctrl+C to stop)..."
    while true; do
        echo "--- $(date) ---"
        dfx canister call cross_nft_launcher_backend call_solana_indexer
        echo ""
        sleep 30
    done
}

# Handle user input
handle_input() {
    case $1 in
        1) check_status ;;
        2) get_state ;;
        3) get_events ;;
        4) trigger_index ;;
        5) start_monitoring ;;
        6) stop_monitoring ;;
        7) restart_monitoring ;;
        8) add_cycles $2 ;;
        9) monitor_continuous ;;
        0) echo "👋 Goodbye!"; exit 0 ;;
        *) echo "❌ Invalid option. Please try again." ;;
    esac
}

# Check if argument provided
if [ $# -eq 0 ]; then
    # Interactive mode
    while true; do
        show_menu
        read -p "Enter your choice: " choice
        handle_input $choice
        echo ""
        read -p "Press Enter to continue..."
        clear
    done
else
    # Command line mode
    handle_input $@
fi 