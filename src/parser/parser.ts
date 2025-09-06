import { CstParser } from 'chevrotain';
import {
  allTokens,
  Dash,
  Bang,
  Comma,
  Equals,
  EOL,
  HashComment,
  SlashComment,
  TimeWord,
  TimeClock,
  Duration,
  CategoryColon,
  CategoryDouble,
  Identifier,
  Text,
  ScratchpadDirective,
  PlannerDirective,
} from '../lexer/tokens';

export class DayPlanParser extends CstParser {
  constructor() {
    super(allTokens);
    this.performSelfAnalysis();
  }

  // Entry point - a program consists of multiple lines
  program = this.RULE('program', () => {
    this.MANY(() => {
      this.SUBRULE(this.line);
    });
  });

  // A line can be a task, directive, comment, or blank
  line = this.RULE('line', () => {
    this.OR([
      {
        ALT: () => {
          this.SUBRULE(this.dashLine);
        },
      },
      {
        ALT: () => {
          this.SUBRULE(this.commentLine);
        },
      },
      {
        ALT: () => {
          this.SUBRULE(this.blankLine);
        },
      },
    ]);
  });

  // Lines that start with dash
  dashLine = this.RULE('dashLine', () => {
    this.CONSUME(Dash);
    this.OR([
      {
        ALT: () => {
          this.SUBRULE(this.directive);
        },
      },
      {
        ALT: () => {
          this.SUBRULE(this.taskParts);
        },
      },
    ]);
    this.OPTION(() => {
      this.SUBRULE(this.comment);
    });
    this.OPTION2(() => {
      this.CONSUME(EOL);
    });
  });

  // Directive: !name key=value key=value or !scratchpad or !planner
  directive = this.RULE('directive', () => {
    this.CONSUME(Bang);
    this.OR([
      {
        ALT: () => {
          this.CONSUME(ScratchpadDirective);
        },
      },
      {
        ALT: () => {
          this.CONSUME(PlannerDirective);
        },
      },
      {
        ALT: () => {
          this.CONSUME(Identifier);
          this.MANY(() => {
            this.SUBRULE(this.keyValue);
          });
        },
      },
    ]);
  });

  // Key=value pairs
  keyValue = this.RULE('keyValue', () => {
    this.CONSUME(Identifier);
    this.CONSUME(Equals);
    this.OR([
      {
        ALT: () => this.CONSUME2(Identifier),
      },
      {
        ALT: () => this.CONSUME(Duration),
      },
      {
        ALT: () => this.CONSUME(TimeClock),
      },
      {
        ALT: () => this.CONSUME(Text),
      },
    ]);
  });

  // Task parts - order-free collection of time, duration, categories, title
  taskParts = this.RULE('taskParts', () => {
    this.MANY(() => {
      this.SUBRULE(this.taskPart);
      this.OPTION(() => {
        this.CONSUME(Comma);
      });
    });
  });

  // Individual task part
  taskPart = this.RULE('taskPart', () => {
    this.OR([
      {
        ALT: () => this.SUBRULE(this.time),
      },
      {
        ALT: () => this.SUBRULE(this.duration),
      },
      {
        ALT: () => this.SUBRULE(this.categories),
      },
      {
        ALT: () => this.SUBRULE(this.titlePart),
      },
    ]);
  });

  // Time expressions
  time = this.RULE('time', () => {
    this.OR([
      {
        ALT: () => this.CONSUME(TimeClock),
      },
      {
        ALT: () => this.CONSUME(TimeWord),
      },
    ]);
  });

  // Duration expressions
  duration = this.RULE('duration', () => {
    this.CONSUME(Duration);
  });

  // Category paths: :root::sub::leaf
  categories = this.RULE('categories', () => {
    this.CONSUME(CategoryColon);
    this.CONSUME(Identifier);
    this.MANY(() => {
      this.CONSUME(CategoryDouble);
      this.CONSUME2(Identifier);
    });
  });

  // Title parts - any text that isn't time/duration/categories
  titlePart = this.RULE('titlePart', () => {
    this.OR([
      {
        ALT: () => this.CONSUME(Identifier),
      },
      {
        ALT: () => this.CONSUME(Text),
      },
    ]);
  });

  // Comments
  comment = this.RULE('comment', () => {
    this.OR([
      {
        ALT: () => this.CONSUME(HashComment),
      },
      {
        ALT: () => this.CONSUME(SlashComment),
      },
    ]);
  });

  // Comment-only lines
  commentLine = this.RULE('commentLine', () => {
    this.SUBRULE(this.comment);
    this.OPTION(() => {
      this.CONSUME(EOL);
    });
  });

  // Blank lines
  blankLine = this.RULE('blankLine', () => {
    this.CONSUME(EOL);
  });
}

// Create a parser instance
export const parser = new DayPlanParser();