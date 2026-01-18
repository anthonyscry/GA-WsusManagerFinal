/**
 * Unit Tests for Toast Service
 * Tests toast notification dispatching
 */

import { toastService } from '../../../services/toastService';

describe('Toast Service', () => {
  let dispatchEventSpy: jest.SpyInstance;
  let dispatchedEvents: CustomEvent[] = [];

  beforeEach(() => {
    jest.clearAllMocks();
    dispatchedEvents = [];
    
    // Spy on window.dispatchEvent
    dispatchEventSpy = jest.spyOn(window, 'dispatchEvent').mockImplementation((event: Event) => {
      if (event instanceof CustomEvent) {
        dispatchedEvents.push(event);
      }
      return true;
    });
  });

  afterEach(() => {
    dispatchEventSpy.mockRestore();
  });

  // =========================================================================
  // show() Tests
  // =========================================================================
  describe('show()', () => {
    
    it('should dispatch wsus_toast custom event', () => {
      toastService.show('Test message', 'info');
      
      expect(dispatchEventSpy).toHaveBeenCalled();
      expect(dispatchedEvents[0].type).toBe('wsus_toast');
    });

    it('should include message in event detail', () => {
      toastService.show('Hello World', 'info');
      
      expect(dispatchedEvents[0].detail.message).toBe('Hello World');
    });

    it('should include type in event detail', () => {
      toastService.show('Test', 'success');
      
      expect(dispatchedEvents[0].detail.type).toBe('success');
    });

    it('should default to info type', () => {
      toastService.show('Test');
      
      expect(dispatchedEvents[0].detail.type).toBe('info');
    });

    it('should include duration in event detail', () => {
      toastService.show('Test', 'info', 5000);
      
      expect(dispatchedEvents[0].detail.duration).toBe(5000);
    });

    it('should generate unique IDs for each toast', () => {
      toastService.show('First');
      toastService.show('Second');
      toastService.show('Third');
      
      const ids = dispatchedEvents.map(e => e.detail.id);
      const uniqueIds = new Set(ids);
      
      expect(uniqueIds.size).toBe(3);
    });

    it('should include incrementing ID prefix', () => {
      toastService.show('Test');
      
      expect(dispatchedEvents[0].detail.id).toMatch(/^toast-\d+$/);
    });
  });

  // =========================================================================
  // success() Tests
  // =========================================================================
  describe('success()', () => {
    
    it('should dispatch event with success type', () => {
      toastService.success('Operation completed');
      
      expect(dispatchedEvents[0].detail.type).toBe('success');
      expect(dispatchedEvents[0].detail.message).toBe('Operation completed');
    });

    it('should pass duration parameter', () => {
      toastService.success('Done', 3000);
      
      expect(dispatchedEvents[0].detail.duration).toBe(3000);
    });
  });

  // =========================================================================
  // error() Tests
  // =========================================================================
  describe('error()', () => {
    
    it('should dispatch event with error type', () => {
      toastService.error('Something went wrong');
      
      expect(dispatchedEvents[0].detail.type).toBe('error');
      expect(dispatchedEvents[0].detail.message).toBe('Something went wrong');
    });

    it('should use longer default duration (7000ms)', () => {
      toastService.error('Error occurred');
      
      expect(dispatchedEvents[0].detail.duration).toBe(7000);
    });

    it('should allow custom duration override', () => {
      toastService.error('Quick error', 2000);
      
      expect(dispatchedEvents[0].detail.duration).toBe(2000);
    });
  });

  // =========================================================================
  // warning() Tests
  // =========================================================================
  describe('warning()', () => {
    
    it('should dispatch event with warning type', () => {
      toastService.warning('Be careful');
      
      expect(dispatchedEvents[0].detail.type).toBe('warning');
      expect(dispatchedEvents[0].detail.message).toBe('Be careful');
    });

    it('should pass duration parameter', () => {
      toastService.warning('Warning', 4000);
      
      expect(dispatchedEvents[0].detail.duration).toBe(4000);
    });
  });

  // =========================================================================
  // info() Tests
  // =========================================================================
  describe('info()', () => {
    
    it('should dispatch event with info type', () => {
      toastService.info('FYI');
      
      expect(dispatchedEvents[0].detail.type).toBe('info');
      expect(dispatchedEvents[0].detail.message).toBe('FYI');
    });

    it('should pass duration parameter', () => {
      toastService.info('Information', 2500);
      
      expect(dispatchedEvents[0].detail.duration).toBe(2500);
    });
  });

  // =========================================================================
  // Integration Tests
  // =========================================================================
  describe('integration', () => {
    
    it('should handle multiple rapid toasts', () => {
      toastService.success('Success 1');
      toastService.error('Error 1');
      toastService.warning('Warning 1');
      toastService.info('Info 1');
      
      expect(dispatchedEvents).toHaveLength(4);
      expect(dispatchedEvents[0].detail.type).toBe('success');
      expect(dispatchedEvents[1].detail.type).toBe('error');
      expect(dispatchedEvents[2].detail.type).toBe('warning');
      expect(dispatchedEvents[3].detail.type).toBe('info');
    });

    it('should handle empty message', () => {
      toastService.info('');
      
      expect(dispatchedEvents[0].detail.message).toBe('');
    });

    it('should handle special characters in message', () => {
      toastService.info('<script>alert("xss")</script>');
      
      expect(dispatchedEvents[0].detail.message).toBe('<script>alert("xss")</script>');
    });
  });
});
