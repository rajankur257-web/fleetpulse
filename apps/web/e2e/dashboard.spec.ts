import { test, expect } from '@playwright/test';

test.describe('Fleet Pulse Dispatcher Dashboard (M7)', () => {
  test('renders live dispatcher HUD, map canvas, and sidebar tabs without console errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // 1. Navigate to dashboard
    await page.goto('/');

    // 2. Validate page title and branding
    await expect(page).toHaveTitle(/Fleet Pulse \| Dispatcher Dashboard/);
    await expect(page.getByText('FLEET PULSE')).toBeVisible();
    await expect(page.getByText('DISPATCH HUD')).toBeVisible();

    // 3. Validate WebSocket live status indicator
    const socketIndicator = page.getByTestId('socket-indicator');
    await expect(socketIndicator).toBeVisible();

    // 4. Validate MapLibre GL canvas container renders
    const mapContainer = page.getByTestId('fleet-map-container');
    await expect(mapContainer).toBeVisible();

    // 5. Validate side panel tabs
    const tabRequests = page.getByTestId('tab-requests');
    const tabDrivers = page.getByTestId('tab-drivers');
    await expect(tabRequests).toBeVisible();
    await expect(tabDrivers).toBeVisible();

    // Click on Drivers tab
    await tabDrivers.click();
    await expect(page.getByPlaceholder('Search driver by name or phone...')).toBeVisible();

    // Click back to Requests tab
    await tabRequests.click();

    // 6. Test New Delivery Request Modal
    const createBtn = page.getByTestId('create-request-btn');
    await expect(createBtn).toBeVisible();
    await createBtn.click();

    // Modal should be visible
    await expect(page.getByText('Create Delivery Request')).toBeVisible();
    await expect(page.getByTestId('submit-request-btn')).toBeVisible();

    // Close modal
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText('Create Delivery Request')).not.toBeVisible();

    // 7. Validate Simulator Floating Controller
    const simControls = page.getByTestId('sim-controls-panel');
    await expect(simControls).toBeVisible();
    await expect(page.getByText('SIMULATOR CONTROLLER')).toBeVisible();

    // 8. Assert no unhandled fatal browser errors occurred
    const fatalErrors = consoleErrors.filter(
      (err) =>
        !err.includes('Failed to load resource') &&
        !err.includes('Failed to fetch') &&
        !err.includes('net::ERR_CONNECTION_REFUSED'),
    );
    expect(fatalErrors).toEqual([]);
  });
});
