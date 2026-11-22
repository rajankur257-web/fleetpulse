import { test, expect } from '@playwright/test';

test.describe('Fleet Pulse Analytics and Algorithm Comparison (M8)', () => {
  test('renders analytics dashboard, heatmap map, comparison replay, ETA calculator, and pulse score leaderboard without errors', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // 1. Start from main dashboard and navigate to Analytics
    await page.goto('/');
    await expect(page.getByText('FLEET PULSE')).toBeVisible();

    // Click on Analytics & Replay nav button
    const analyticsNavBtn = page.getByRole('link', { name: /Analytics & Replay/i });
    await expect(analyticsNavBtn).toBeVisible();
    await analyticsNavBtn.click();

    // 2. Verify Analytics Page URL and Header
    await expect(page).toHaveURL(/\/analytics/);
    await expect(
      page.getByRole('heading', { name: 'Fleet Analytics & Intelligence' }),
    ).toBeVisible();

    // 3. Verify KPI Summary Cards
    await expect(page.getByText('Avg Wait Time').first()).toBeVisible();
    await expect(page.getByText('Avg Assignment').first()).toBeVisible();
    await expect(page.getByText('Total Distance').first()).toBeVisible();
    await expect(page.getByText('Driver Utilization').first()).toBeVisible();
    await expect(page.getByText('Acceptance Rate').first()).toBeVisible();
    await expect(page.getByText('Requests / Hour').first()).toBeVisible();

    // 4. Verify Demand Heatmap Map and Layer Toggles
    const demandMap = page.getByTestId('analytics-demand-map');
    await expect(demandMap).toBeVisible();
    await expect(page.getByRole('button', { name: /Heatmap/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Reposition Hints/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Dead Zones/i })).toBeVisible();

    // 5. Verify Dead-Zone and Reposition Alerts Section
    await expect(page.getByText('Dead-Zone Detection').first()).toBeVisible();
    await expect(page.getByText('Idle-Driver Repositioning Hints').first()).toBeVisible();

    // 6. Verify Algorithm Comparison Replay Section
    await expect(
      page.getByRole('heading', { name: 'Algorithm Comparison Replay (M8)' }),
    ).toBeVisible();
    await expect(page.getByText('Nearest Driver').first()).toBeVisible();
    await expect(page.getByText('Scored Multi-Factor').first()).toBeVisible();
    await expect(page.getByText('Batch (Hungarian)').first()).toBeVisible();
    await expect(
      page.getByText('100% Deterministic Reproducibility Verified'),
    ).toBeVisible();

    // 7. Verify OSRM Road ETA vs Haversine Distance Calculator
    await expect(
      page.getByRole('heading', { name: 'Haversine Distance vs OSRM Road ETA' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Calculate Route Comparison' })).toBeVisible();

    // Test route preset selection
    const presetBtn = page.getByRole('button', { name: /Koramangala/i });
    await expect(presetBtn).toBeVisible();
    await presetBtn.click();

    // 8. Verify Driver Pulse Score Leaderboard
    await expect(
      page.getByRole('heading', { name: /Driver Pulse Score Leaderboard/i }),
    ).toBeVisible();
    await expect(page.getByPlaceholder('Search driver...')).toBeVisible();

    // Filter toggle check
    const availableFilter = page.getByRole('button', { name: 'Available' });
    await expect(availableFilter).toBeVisible();
    await availableFilter.click();

    // 9. Assert no fatal client-side exceptions occurred
    const fatalErrors = consoleErrors.filter(
      (err) =>
        !err.includes('Failed to load resource') &&
        !err.includes('Failed to fetch') &&
        !err.includes('net::ERR_CONNECTION_REFUSED'),
    );
    expect(fatalErrors).toEqual([]);
  });
});
