// ==UserScript==
// @name         Torn Bank Investment Calculator with Enhanced Features
// @namespace    http://tampermonkey.net/
// @version      3.6
// @description  Calculates Torn bank investment profit with merits, TCB stock, and displays the shortest path to target amount with profit and time.
// @author       Jvmie
// @match        https://www.torn.com/bank.php*
// @updateURL    https://raw.githubusercontent.com/ItzJamiie/torn-bank-calc/main/torn-bank-calc.user.js
// @downloadURL  https://raw.githubusercontent.com/ItzJamiie/torn-bank-calc/main/torn-bank-calc.user.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const CURRENT_VERSION = '3.6'; // Must match @version
    const SCRIPT_URL = 'https://raw.githubusercontent.com/ItzJamiie/torn-bank-calc/main/torn-bank-calc.user.js';

    // Function to check for updates (for compatibility with TornPDA)
    function checkForScriptUpdate() {
        fetch(SCRIPT_URL)
            .then(response => response.text())
            .then(text => {
                const versionMatch = text.match(/@version\s+([\d.]+)/);
                if (versionMatch && versionMatch[1] && versionMatch[1] !== CURRENT_VERSION) {
                    console.log(`Torn Bank Calc: New version ${versionMatch[1]} detected. Notify TornPDA to update.`);
                    // TornPDA may handle the update prompt; this log helps debugging
                }
            })
            .catch(err => console.error('Torn Bank Calc: Update check failed:', err));
    }

    setInterval(checkForScriptUpdate, 300000); // Check every 5 minutes

    let investmentOptions = [
        { period: 7, baseRate: 0.6889, label: '7 Days (0.69% base)' },
        { period: 14, baseRate: 0.800, label: '14 Days (0.80% base)' },
        { period: 30, baseRate: 0.833, label: '30 Days (0.83% base)' },
        { period: 60, baseRate: 0.953, label: '60 Days (0.95% base)' },
        { period: 90, baseRate: 0.953, label: '90 Days (0.95% base)' }
    ];

    const MAX_INVESTMENT = 2000000000;
    const VERSION = '3.6';

    const CHANGELOG = `
        <strong>Changelog:</strong>
        <ul>
            <li><strong>Version 3.5:</strong> Optimized for TornPDA update system.</li>
            <li><strong>Version 3.3:</strong> Added a one-time update notification.</li>
            <li><strong>Version 3.2:</strong> Changed output to show only the shortest path.</li>
            <li><strong>Version 3.1:</strong> Removed 'Collapse' from button, added version in bottom left.</li>
            <li><strong>Version 3.0:</strong> Made result table collapsible.</li>
            <li><strong>Version 2.9:</strong> Changed 'Days to Target' to 'Time to Target'.</li>
            <li><strong>Version 2.7:</strong> Added dynamic base rate fetching.</li>
            <li><strong>Version 2.1:</strong> Introduced reinvestment and comparison table.</li>
        </ul>
    `;

    function formatCurrency(value) {
        if (value >= 1000000000) return `${(value / 1000000000).toFixed(1)}b`;
        if (value >= 1000000) return `${(value / 1000000).toFixed(1)}m`;
        if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
        return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    }

    function parseInput(value) {
        value = value.trim().toLowerCase().replace(/[^0-9.kmb]/g, '');
        if (value.endsWith('k')) return parseFloat(value.replace('k', '')) * 1000;
        if (value.endsWith('m')) return parseFloat(value.replace('m', '')) * 1000000;
        if (value.endsWith('b')) return parseFloat(value.replace('b', '')) * 1000000000;
        return parseFloat(value) || 0;
    }

    function formatDays(days) {
        if (days === Infinity) return 'N/A (Cap Reached)';
        if (days === 0) return '0d';
        const years = Math.floor(days / 365);
        const months = Math.floor((days % 365) / 30);
        const daysRemain = days % 30;
        let result = '';
        if (years > 0) result += `${years}y `;
        if (months > 0 || years > 0) result += `${months}m `;
        result += `${daysRemain}d`;
        return result.trim();
    }

    function fetchDynamicBaseRates(merits) {
        try {
            const rateElements = document.querySelectorAll('.bar-label, .apr-value, [class*="apr"]');
            if (!rateElements.length) {
                console.warn('Torn Bank Calc: Using default rates.');
                return;
            }
            const aprValues = Array.from(rateElements).map(el => {
                const match = el.textContent.trim().match(/(\d+\.\d+)%/);
                return match ? parseFloat(match[1]) : null;
            }).filter(v => v !== null);
            if (aprValues.length >= 5) {
                const meritMultiplier = 1 + (merits * 0.05);
                const baseRates = aprValues.map(apr => (apr / 52 / meritMultiplier) * 100);
                investmentOptions.forEach((opt, i) => opt.baseRate = baseRates[i] || opt.baseRate);
                investmentOptions.forEach(opt => opt.label = `${opt.period} Days (${opt.baseRate.toFixed(2)}% base)`);
                console.log('Torn Bank Calc: Updated rates:', investmentOptions);
            } else {
                console.warn('Torn Bank Calc: Insufficient APR data.');
            }
        } catch (e) {
            console.error('Torn Bank Calc: Rate fetch error:', e);
        }
    }

    function showChangelogNotification() {
        const lastSeen = localStorage.getItem('tornBankCalcLastSeenVersion');
        if (lastSeen === VERSION) return;
        const div = document.createElement('div');
        div.id = 'torn-bank-calc-changelog';
        div.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#1c2526;border:1px solid #3e4a50;border-radius:5px;padding:10px;max-width:300px;color:#fff;font-family:Arial,sans-serif;font-size:14px;z-index:10000;box-shadow:0 2px 5px rgba(0,0,0,0.5)';
        div.innerHTML = `<div style="margin-bottom:10px;">${CHANGELOG}</div><button id="closeChangelogBtn" style="display:block;margin:0 auto;padding:5px 10px;background:#28a745;color:#fff;border:none;border-radius:3px;cursor:pointer">Close</button>`;
        document.body.appendChild(div);
        document.getElementById('closeChangelogBtn').addEventListener('click', () => {
            div.remove();
            localStorage.setItem('tornBankCalcLastSeenVersion', VERSION);
        });
    }

    function createCalculatorUI() {
        let container = document.querySelector('#mainContainer .content-wrapper, .content-wrapper, #bankBlock, .content, body');
        if (!container || document.getElementById('torn-bank-calc')) return;
        const div = document.createElement('div');
        div.id = 'torn-bank-calc';
        div.style.cssText = 'margin-top:20px;font-family:Arial,sans-serif;font-size:14px;max-width:400px;overflow-x:hidden';
        const savedMerits = localStorage.getItem('tornBankCalcMerits') || '0';
        const savedStock = localStorage.getItem('tornBankCalcStockBonus') === 'true';
        const meritOptions = Array.from({length: 11}, (_, i) => `<option value="${i}" ${i == savedMerits ? 'selected' : ''}>${i} Merits (+${i*5}%)</option>`).join('');
        div.innerHTML = `
            <details id="calcDetails" style="margin-bottom:10px;border:1px solid #2a3439;border-radius:5px;">
                <summary style="cursor:pointer;padding:10px;background:#28a745;border-radius:3px;color:#fff;text-align:center;font-weight:bold">Investment Calculator</summary>
                <div style="padding:15px;background:#1c2526;border-radius:0 0 3px 3px">
                    <label style="display:block;margin-bottom:5px;color:#d0d0d0">Principal ($):</label>
                    <input type="text" id="principal" placeholder="Enter amount (e.g., 2000m)" style="width:100%;padding:5px;background:#2a3439;color:#fff;border:1px solid #3e4a50;border-radius:3px;margin-bottom:10px">
                    <label style="display:block;margin-bottom:5px;color:#d0d0d0">Target Amount ($):</label>
                    <input type="text" id="targetAmount" placeholder="Enter target (e.g., 3000m)" style="width:100%;padding:5px;background:#2a3439;color:#fff;border:1px solid #3e4a50;border-radius:3px;margin-bottom:10px">
                    <label style="display:block;margin-bottom:5px;color:#d0d0d0">Bank Merits:</label>
                    <select id="meritSelect" style="width:100%;padding:5px;background:#2a3439;color:#fff;border:1px solid #3e4a50;border-radius:3px;margin-bottom:10px">${meritOptions}</select>
                    <label style="display:block;margin-bottom:10px;color:#d0d0d0"><input type="checkbox" id="stockBonus" style="vertical-align:middle;margin-right:5px" ${savedStock ? 'checked' : ''}> Own TCB Stock (+10%)</label>
                    <button id="calculateBtn" style="width:100%;padding:8px;background:#28a745;color:#fff;border:none;border-radius:3px;cursor:pointer">Calculate</button>
                    <div id="result" style="margin-top:15px"><label style="display:block;margin-top:10px;color:#fff">Shortest Path to Target:</label><table id="comparisonTable" style="width:100%;max-width:400px;border-collapse:collapse;margin-top:10px;table-layout:fixed"><thead><tr style="background:#2a3439"><th style="padding:5px;border:1px solid #3e4a50;color:#fff;width:25%">Period</th><th style="padding:5px;border:1px solid #3e4a50;color:#fff;width:25%">Method</th><th style="padding:5px;border:1px solid #3e4a50;color:#fff;width:25%">Time to Target</th><th style="padding:5px;border:1px solid #3e4a50;color:#fff;width:25%">Profit</th></tr></thead><tbody id="comparisonTableBody"><tr><td colspan="4" style="text-align:center;padding:5px;color:#fff">Enter values and calculate to compare</td></tr></tbody></table></div>
                </div>
            </details>
        `;
        container.appendChild(div);
        const versionDiv = document.createElement('div');
        versionDiv.id = 'torn-bank-calc-version';
        versionDiv.style.cssText = 'position:fixed;bottom:10px;left:10px;color:#fff;font-size:12px;font-family:Arial,sans-serif;z-index:1000;background:rgba(0,0,0,0.5);padding:2px 5px;border-radius:3px';
        versionDiv.innerHTML = `Torn Bank Calc V${VERSION}`;
        document.body.appendChild(versionDiv);
        showChangelogNotification();
        document.getElementById('calcDetails').open = false;
        document.getElementById('meritSelect').addEventListener('change', () => {
            localStorage.setItem('tornBankCalcMerits', document.getElementById('meritSelect').value);
            fetchDynamicBaseRates(parseInt(document.getElementById('meritSelect').value));
        });
        document.getElementById('stockBonus').addEventListener('change', () => localStorage.setItem('tornBankCalcStockBonus', document.getElementById('stockBonus').checked));
        fetchDynamicBaseRates(parseInt(savedMerits));
    }

    function calculateTimeToTargetNoReinvest(principal, target, rate, period) {
        if (principal >= target) return { periods: 0, days: 0, profit: 0 };
        const ratePerPeriod = rate / 100;
        const profitPerPeriod = principal * ratePerPeriod;
        const periodsNeeded = Math.ceil((target - principal) / profitPerPeriod);
        return { periods: periodsNeeded, days: periodsNeeded * period, profit: periodsNeeded * profitPerPeriod };
    }

    function calculateTimeToTargetWithReinvest(principal, target, rate, period) {
        if (principal >= target) return { periods: 0, days: 0, profit: 0 };
        const ratePerPeriod = rate / 100;
        let amount = principal, periods = 0;
        while (amount < target) {
            let invest = Math.min(amount, MAX_INVESTMENT);
            amount += invest * ratePerPeriod;
            periods++;
            if (periods > 10000) return { periods: Infinity, days: Infinity, profit: 0 };
        }
        return { periods, days: periods * period, profit: amount - principal };
    }

    function calculateProfitAndProjection() {
        try {
            const principal = parseInput(document.getElementById('principal').value);
            if (principal < 1000) throw new Error('Principal too low.');
            const target = parseInput(document.getElementById('targetAmount').value);
            if (target <= principal) throw new Error('Target must exceed principal.');
            const merits = parseInt(document.getElementById('meritSelect').value);
            const hasStock = document.getElementById('stockBonus').checked;
            fetchDynamicBaseRates(merits);
            updateComparisonTable(principal, target, merits, hasStock);
        } catch (e) {
            console.error('Torn Bank Calc Error:', e);
            document.getElementById('result').innerHTML = `Error: ${e.message || 'Check inputs'}`;
        }
    }

    function updateComparisonTable(principal, target, merits, hasStock) {
        const body = document.getElementById('comparisonTableBody');
        let shortest = { days: Infinity };
        investmentOptions.forEach(opt => {
            const multiplier = 1 + (merits * 0.05);
            let rate = opt.baseRate * multiplier * (hasStock ? 1.10 : 1) * (opt.period / 7);
            const noReinvest = calculateTimeToTargetNoReinvest(principal, target, rate, opt.period);
            if (noReinvest.days < shortest.days) shortest = { ...noReinvest, period: opt.label, method: 'No Reinvest' };
            const reinvest = calculateTimeToTargetWithReinvest(principal, target, rate, opt.period);
            if (reinvest.days < shortest.days) shortest = { ...reinvest, period: opt.label, method: 'Reinvest' };
        });
        body.innerHTML = shortest.days !== Infinity ? `
            <tr><td style="padding:5px;border:1px solid #3e4a50;color:#fff;text-align:center;width:25%">${shortest.period}</td>
            <td style="padding:5px;border:1px solid #3e4a50;color:#fff;text-align:center;width:25%">${shortest.method}</td>
            <td style="padding:5px;border:1px solid #3e4a50;color:#fff;text-align:center;width:25%">${formatDays(shortest.days)}</td>
            <td style="padding:5px;border:1px solid #3e4a50;color:#fff;text-align:center;width:25%">${formatCurrency(shortest.profit)}</td></tr>` :
            '<tr><td colspan="4" style="text-align:center;padding:5px;color:#fff">No valid path</td></tr>';
    }

    function init() {
        createCalculatorUI();
        document.getElementById('calculateBtn').addEventListener('click', calculateProfitAndProjection);
    }

    function waitForPageLoad() {
        if (document.readyState === 'complete') init();
        else window.addEventListener('load', init);
        let attempts = 0;
        const interval = setInterval(() => {
            if (++attempts > 10) {
                clearInterval(interval);
                init();
            } else if (document.readyState === 'complete') {
                clearInterval(interval);
                init();
            }
        }, 1000);
    }

    waitForPageLoad();
})();