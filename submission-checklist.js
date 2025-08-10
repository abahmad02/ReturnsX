#!/usr/bin/env node

// ReturnsX App Store Submission Checklist
// Run this to track your progress toward submission

import fs from 'fs';
import path from 'path';

class SubmissionTracker {
  constructor() {
    this.checklist = {
      appListing: {
        title: "📝 App Store Listing Creation",
        priority: "URGENT",
        items: [
          { task: "Access Partner Dashboard and create listing", completed: false, timeEstimate: "30min" },
          { task: "Write app name and description", completed: false, timeEstimate: "2hrs" },
          { task: "Create app icon (1200x1200px)", completed: false, timeEstimate: "3hrs" },
          { task: "Take screenshots (3-6 required)", completed: false, timeEstimate: "2hrs" },
          { task: "Record feature video or create feature image", completed: false, timeEstimate: "4hrs" },
          { task: "Set up pricing plans and billing", completed: false, timeEstimate: "1hr" },
          { task: "Write privacy policy and add URL", completed: false, timeEstimate: "2hrs" },
          { task: "Submit initial listing draft", completed: false, timeEstimate: "30min" }
        ]
      },
      
      demoStore: {
        title: "🏪 Demo Store Setup",
        priority: "HIGH", 
        items: [
          { task: "Create or configure development store", completed: false, timeEstimate: "30min" },
          { task: "Install ReturnsX on demo store", completed: false, timeEstimate: "15min" },
          { task: "Add sample products and customer data", completed: false, timeEstimate: "1hr" },
          { task: "Configure realistic risk scenarios", completed: false, timeEstimate: "45min" },
          { task: "Test all features end-to-end", completed: false, timeEstimate: "2hrs" },
          { task: "Create demo walkthrough documentation", completed: false, timeEstimate: "1hr" },
          { task: "Verify demo store accessibility", completed: false, timeEstimate: "15min" }
        ]
      },
      
      performanceTesting: {
        title: "🧪 Performance Testing",
        priority: "HIGH",
        items: [
          { task: "Install testing dependencies (lighthouse, puppeteer)", completed: false, timeEstimate: "15min" },
          { task: "Run Lighthouse tests on checkout pages", completed: false, timeEstimate: "30min" },
          { task: "Measure script performance impact (<10 points)", completed: false, timeEstimate: "45min" },
          { task: "Test on Chrome, Firefox, Safari, Edge", completed: false, timeEstimate: "2hrs" },
          { task: "Document performance test results", completed: false, timeEstimate: "30min" },
          { task: "Optimize if performance impact > 10 points", completed: false, timeEstimate: "3hrs" }
        ]
      },
      
      supportSetup: {
        title: "📞 Support Infrastructure",
        priority: "MEDIUM",
        items: [
          { task: "Set up support email address", completed: false, timeEstimate: "30min" },
          { task: "Create installation guide with screenshots", completed: false, timeEstimate: "3hrs" },
          { task: "Write comprehensive FAQ page", completed: false, timeEstimate: "2hrs" },
          { task: "Update Partner Dashboard contact info", completed: false, timeEstimate: "15min" },
          { task: "Create help center/documentation website", completed: false, timeEstimate: "4hrs" },
          { task: "Prepare app review instructions", completed: false, timeEstimate: "1hr" },
          { task: "Set up auto-responder email templates", completed: false, timeEstimate: "30min" }
        ]
      },
      
      finalTesting: {
        title: "🔍 Final Testing & Validation",
        priority: "MEDIUM",
        items: [
          { task: "Test complete installation flow", completed: false, timeEstimate: "30min" },
          { task: "Verify all webhooks are working", completed: false, timeEstimate: "45min" },
          { task: "Check for 404/500 errors in app", completed: false, timeEstimate: "30min" },
          { task: "Test uninstall and reinstall flows", completed: false, timeEstimate: "30min" },
          { task: "Validate compliance webhook responses", completed: false, timeEstimate: "30min" },
          { task: "Review app against Shopify requirements", completed: false, timeEstimate: "1hr" }
        ]
      }
    };
    
    this.loadProgress();
  }
  
  loadProgress() {
    const progressFile = 'submission-progress.json';
    if (fs.existsSync(progressFile)) {
      try {
        const saved = JSON.parse(fs.readFileSync(progressFile, 'utf8'));
        this.mergeProgress(saved);
      } catch (error) {
        console.log('Could not load previous progress, starting fresh.');
      }
    }
  }
  
  saveProgress() {
    fs.writeFileSync('submission-progress.json', JSON.stringify(this.checklist, null, 2));
  }
  
  mergeProgress(saved) {
    Object.keys(saved).forEach(category => {
      if (this.checklist[category]) {
        saved[category].items.forEach((savedItem, index) => {
          if (this.checklist[category].items[index]) {
            this.checklist[category].items[index].completed = savedItem.completed;
          }
        });
      }
    });
  }
  
  displayProgress() {
    console.log('🚀 RETURNSX APP STORE SUBMISSION PROGRESS');
    console.log('==========================================\\n');
    
    let totalTasks = 0;
    let completedTasks = 0;
    let totalTimeRemaining = 0;
    
    Object.entries(this.checklist).forEach(([key, category]) => {
      const categoryCompleted = category.items.filter(item => item.completed).length;
      const categoryTotal = category.items.length;
      const percentage = Math.round((categoryCompleted / categoryTotal) * 100);
      
      console.log(`${category.title}`);
      console.log(`Priority: ${category.priority} | Progress: ${categoryCompleted}/${categoryTotal} (${percentage}%)`);
      console.log('─'.repeat(50));
      
      category.items.forEach((item, index) => {
        const status = item.completed ? '✅' : '⏳';
        const timeInfo = item.completed ? '' : ` (${item.timeEstimate})`;
        console.log(`  ${status} ${item.task}${timeInfo}`);
        
        if (!item.completed) {
          totalTimeRemaining += this.parseTimeEstimate(item.timeEstimate);
        }
      });
      
      console.log('');
      totalTasks += categoryTotal;
      completedTasks += categoryCompleted;
    });
    
    const overallPercentage = Math.round((completedTasks / totalTasks) * 100);
    const timeRemainingFormatted = this.formatTime(totalTimeRemaining);
    
    console.log('📊 OVERALL PROGRESS');
    console.log('==================');
    console.log(`Completed: ${completedTasks}/${totalTasks} tasks (${overallPercentage}%)`);
    console.log(`Estimated time remaining: ${timeRemainingFormatted}`);
    console.log(`Status: ${this.getSubmissionStatus(overallPercentage)}`);
    
    this.showNextActions();
  }
  
  parseTimeEstimate(timeStr) {
    const match = timeStr.match(/(\\d+)(\\w+)/);
    if (!match) return 0;
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    switch(unit) {
      case 'min': return value;
      case 'hr': case 'hrs': return value * 60;
      case 'day': case 'days': return value * 480; // 8 work hours
      default: return 0;
    }
  }
  
  formatTime(minutes) {
    if (minutes < 60) return `${minutes} minutes`;
    const hours = Math.floor(minutes / 60);
    const remainingMins = minutes % 60;
    return `${hours}h ${remainingMins}m`;
  }
  
  getSubmissionStatus(percentage) {
    if (percentage >= 90) return '🎉 Ready for submission!';
    if (percentage >= 70) return '🔧 Almost ready - final touches needed';
    if (percentage >= 50) return '⚡ Good progress - keep going!';
    if (percentage >= 25) return '🏃 Getting started - focus on high priority items';
    return '🚀 Just beginning - start with app listing creation';
  }
  
  showNextActions() {
    console.log('\\n🎯 RECOMMENDED NEXT ACTIONS');
    console.log('============================\\n');
    
    // Find highest priority incomplete tasks
    const urgentTasks = [];
    const highTasks = [];
    
    Object.entries(this.checklist).forEach(([key, category]) => {
      category.items.forEach(item => {
        if (!item.completed) {
          if (category.priority === 'URGENT') {
            urgentTasks.push({...item, category: category.title});
          } else if (category.priority === 'HIGH') {
            highTasks.push({...item, category: category.title});
          }
        }
      });
    });
    
    if (urgentTasks.length > 0) {
      console.log('🚨 URGENT TASKS (Start immediately):');
      urgentTasks.slice(0, 3).forEach(task => {
        console.log(`  • ${task.task} (${task.timeEstimate})`);
      });
      console.log('');
    }
    
    if (highTasks.length > 0) {
      console.log('⚡ HIGH PRIORITY (Complete this week):');
      highTasks.slice(0, 3).forEach(task => {
        console.log(`  • ${task.task} (${task.timeEstimate})`);
      });
      console.log('');
    }
    
    console.log('💡 Quick wins to boost progress:');
    console.log('  • Update Partner Dashboard contacts (15min)');
    console.log('  • Install performance testing tools (15min)');
    console.log('  • Create basic app description draft (30min)');
    console.log('');
    
    console.log('📅 Suggested timeline:');
    console.log('  Day 1-2: Complete app listing creation');
    console.log('  Day 3: Set up demo store with sample data');
    console.log('  Day 4: Run performance tests and browser checks');
    console.log('  Day 5: Finalize support infrastructure');
    console.log('  Day 6: Final testing and submission');
  }
  
  markCompleted(categoryKey, taskIndex) {
    if (this.checklist[categoryKey] && this.checklist[categoryKey].items[taskIndex]) {
      this.checklist[categoryKey].items[taskIndex].completed = true;
      this.saveProgress();
      console.log('✅ Task marked as completed!');
    } else {
      console.log('❌ Invalid task reference');
    }
  }
  
  interactive() {
    import('readline').then(({ createInterface }) => {
      const rl = createInterface({
        input: process.stdin,
        output: process.stdout
      });
    
    console.log('\\n🔧 Interactive Mode');
    console.log('Commands: list, complete [category] [index], progress, quit');
    
    const askCommand = () => {
      rl.question('\\nEnter command: ', (answer) => {
        const [cmd, ...args] = answer.trim().split(' ');
        
        switch(cmd.toLowerCase()) {
          case 'list':
            this.displayProgress();
            askCommand();
            break;
            
          case 'complete':
            if (args.length >= 2) {
              this.markCompleted(args[0], parseInt(args[1]));
            } else {
              console.log('Usage: complete [category] [taskIndex]');
            }
            askCommand();
            break;
            
          case 'progress':
            this.displayProgress();
            askCommand();
            break;
            
          case 'quit':
          case 'exit':
            rl.close();
            break;
            
          default:
            console.log('Unknown command. Try: list, complete, progress, quit');
            askCommand();
        }
      });
    };
    
    askCommand();
  }
}

// CLI Interface
if (require.main === module) {
  const tracker = new SubmissionTracker();
  
  const args = process.argv.slice(2);
  
  if (args[0] === 'interactive' || args[0] === 'i') {
    tracker.interactive();
  } else if (args[0] === 'complete' && args.length >= 3) {
    tracker.markCompleted(args[1], parseInt(args[2]));
    tracker.displayProgress();
  } else {
    tracker.displayProgress();
    
    console.log('\\n💻 Usage:');
    console.log('  node submission-checklist.js                    # Show progress');
    console.log('  node submission-checklist.js interactive        # Interactive mode');
    console.log('  node submission-checklist.js complete [cat] [i] # Mark task complete');
  }
}

module.exports = SubmissionTracker;
